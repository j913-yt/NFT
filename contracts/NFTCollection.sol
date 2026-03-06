// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Graduation NFT + Minimal Marketplace
/// @notice Supports minting, listing, and direct native-token purchase on-chain.
contract NFTCollection is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    struct Listing {
        address seller;
        uint256 priceWei;
        bool active;
    }

    mapping(uint256 => Listing) private _listings;

    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 priceWei);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event Purchased(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 priceWei
    );

    constructor() ERC721("GraduationNFT", "GNFT") Ownable() {}

    function safeMint(address to, string memory uri) external returns (uint256) {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    /// @notice Mint to caller and immediately list with a native-token price.
    function mintAndList(string memory uri, uint256 priceWei) external returns (uint256) {
        require(priceWei > 0, "price must be > 0");

        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

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

    function buy(uint256 tokenId) external payable {
        Listing memory listing = _listings[tokenId];
        require(listing.active, "not listed");
        require(listing.seller != address(0), "invalid seller");
        require(ownerOf(tokenId) == listing.seller, "listing stale");
        require(msg.sender != listing.seller, "cannot buy own nft");
        require(msg.value == listing.priceWei, "wrong payment amount");

        delete _listings[tokenId];

        _transfer(listing.seller, msg.sender, tokenId);

        (bool sent, ) = payable(listing.seller).call{value: msg.value}("");
        require(sent, "payment transfer failed");

        emit Purchased(tokenId, listing.seller, msg.sender, msg.value);
    }

    function getListing(uint256 tokenId) external view returns (address seller, uint256 priceWei, bool active) {
        Listing memory listing = _listings[tokenId];

        if (!listing.active) {
            return (address(0), 0, false);
        }

        if (!_exists(tokenId) || ownerOf(tokenId) != listing.seller) {
            return (listing.seller, listing.priceWei, false);
        }

        return (listing.seller, listing.priceWei, true);
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}