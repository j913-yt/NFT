// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title Graduation NFT + Marketplace + EIP-2981 Royalty
/// @notice Supports minting, listing, native-token purchase, and royalty payout.
contract NFTCollection is ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard {
    uint96 public constant FEE_DENOMINATOR = 10_000;
    uint96 public constant MAX_ROYALTY_BPS = 2_500; // 25%

    uint256 private _tokenIdCounter;

    struct Listing {
        address seller;
        uint256 priceWei;
        bool active;
    }

    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => uint96) private _tokenRoyaltyBps;

    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 priceWei);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event RoyaltySet(uint256 indexed tokenId, address indexed receiver, uint96 royaltyFeeBps);
    event Purchased(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 priceWei,
        address royaltyReceiver,
        uint256 royaltyAmountWei,
        uint256 sellerAmountWei
    );

    constructor() ERC721("GraduationNFT", "GNFT") Ownable() {}

    function safeMint(address to, string memory uri) external returns (uint256) {
        return safeMint(to, uri, address(0), 0);
    }

    function safeMint(
        address to,
        string memory uri,
        address royaltyReceiver,
        uint96 royaltyFeeBps
    ) public returns (uint256) {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _configureRoyalty(tokenId, to, royaltyReceiver, royaltyFeeBps);

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    /// @notice Mint to caller and immediately list with a native-token price.
    function mintAndList(string memory uri, uint256 priceWei) external returns (uint256) {
        return mintAndList(uri, priceWei, address(0), 0);
    }

    function mintAndList(
        string memory uri,
        uint256 priceWei,
        address royaltyReceiver,
        uint96 royaltyFeeBps
    ) public returns (uint256) {
        require(priceWei > 0, "price must be > 0");

        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        _configureRoyalty(tokenId, msg.sender, royaltyReceiver, royaltyFeeBps);

        _listings[tokenId] = Listing({seller: msg.sender, priceWei: priceWei, active: true});

        emit Minted(msg.sender, tokenId, uri);
        emit Listed(tokenId, msg.sender, priceWei);
        return tokenId;
    }

    function listToken(uint256 tokenId, uint256 priceWei) external {
        require(_exists(tokenId), "token not found");
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(priceWei > 0, "price must be > 0");

        _listings[tokenId] = Listing({seller: msg.sender, priceWei: priceWei, active: true});
        emit Listed(tokenId, msg.sender, priceWei);
    }

    function cancelListing(uint256 tokenId) external {
        Listing memory listing = _listings[tokenId];
        require(listing.active, "not listed");
        require(listing.seller == msg.sender, "not seller");

        delete _listings[tokenId];
        emit Delisted(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = _listings[tokenId];
        require(listing.active, "not listed");
        require(listing.seller != address(0), "invalid seller");
        require(ownerOf(tokenId) == listing.seller, "listing stale");
        require(msg.sender != listing.seller, "cannot buy own nft");
        require(msg.value == listing.priceWei, "wrong payment amount");

        delete _listings[tokenId];
        _transfer(listing.seller, msg.sender, tokenId);

        (address royaltyReceiver, uint256 royaltyAmount) = royaltyInfo(tokenId, msg.value);
        uint256 sellerAmount = msg.value;

        if (royaltyReceiver == listing.seller) {
            royaltyAmount = 0;
        } else if (royaltyReceiver != address(0) && royaltyAmount > 0) {
            require(royaltyAmount < msg.value, "invalid royalty");
            sellerAmount = msg.value - royaltyAmount;
            (bool royaltySent, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltySent, "royalty transfer failed");
        }

        (bool sellerSent, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSent, "payment transfer failed");

        emit Purchased(
            tokenId,
            listing.seller,
            msg.sender,
            msg.value,
            royaltyReceiver,
            royaltyAmount,
            sellerAmount
        );
    }

    function getListing(
        uint256 tokenId
    ) external view returns (address seller, uint256 priceWei, bool active) {
        Listing memory listing = _listings[tokenId];

        if (!listing.active) {
            return (address(0), 0, false);
        }

        if (!_exists(tokenId) || ownerOf(tokenId) != listing.seller) {
            return (listing.seller, listing.priceWei, false);
        }

        return (listing.seller, listing.priceWei, true);
    }

    function getRoyaltyInfo(
        uint256 tokenId,
        uint256 salePriceWei
    ) external view returns (address receiver, uint256 royaltyAmount, uint96 royaltyFeeBps) {
        require(_exists(tokenId), "token not found");
        (receiver, royaltyAmount) = royaltyInfo(tokenId, salePriceWei);
        royaltyFeeBps = _tokenRoyaltyBps[tokenId];
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function _configureRoyalty(
        uint256 tokenId,
        address fallbackReceiver,
        address royaltyReceiver,
        uint96 royaltyFeeBps
    ) internal {
        if (royaltyFeeBps == 0) {
            _resetTokenRoyalty(tokenId);
            _tokenRoyaltyBps[tokenId] = 0;
            return;
        }

        require(royaltyFeeBps <= MAX_ROYALTY_BPS, "royalty too high");
        address receiver = royaltyReceiver == address(0) ? fallbackReceiver : royaltyReceiver;
        require(receiver != address(0), "invalid royalty receiver");

        _setTokenRoyalty(tokenId, receiver, royaltyFeeBps);
        _tokenRoyaltyBps[tokenId] = royaltyFeeBps;
        emit RoyaltySet(tokenId, receiver, royaltyFeeBps);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721URIStorage, ERC721Royalty) {
        super._burn(tokenId);
        delete _tokenRoyaltyBps[tokenId];
        delete _listings[tokenId];
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
