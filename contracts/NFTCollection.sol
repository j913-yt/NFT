// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title 毕业 NFT + 市场 + EIP-2981 版税
/// @notice 支持铸造、上架、使用链原生代币购买，以及版税分账。
/// @dev 组合 ERC-721 元数据存储能力和一个最小固定价格市场。
contract NFTCollection is ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard {
    /// @notice 版税计算使用的基点分母。
    uint96 public constant FEE_DENOMINATOR = 10_000;

    /// @notice 单个 Token 允许设置的最大版税比例，单位为基点。
    uint96 public constant MAX_ROYALTY_BPS = 2_500; // 25%

    /// @dev 只递增的 Token ID 计数器，Token ID 从 1 开始。
    uint256 private _tokenIdCounter;

    /// @notice Token 的固定价格上架信息。
    struct Listing {
        /// @notice 当前拥有该 Token 并接收成交款的卖家地址。
        address seller;

        /// @notice 购买该 NFT 需要支付的链原生代币精确价格。
        uint256 priceWei;

        /// @notice 当前上架信息是否可用。
        bool active;
    }

    /// @dev Token ID 到上架状态的映射。过期上架会在 getListing 中展示为未激活。
   

    /// @notice Token 铸造并写入元数据 URI 后触发。
    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);

    /// @notice Token 被固定价格上架或重新上架时触发。
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 priceWei);

    /// @notice 卖家取消有效上架时触发。
    event Delisted(uint256 indexed tokenId, address indexed seller);

    /// @notice 保存 Token 专属版税设置时触发。
    event RoyaltySet(uint256 indexed tokenId, address indexed receiver, uint96 royaltyFeeBps);

    /// @notice 已上架 Token 被购买并完成资金分配后触发。
    event Purchased(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 priceWei,
        address royaltyReceiver,
        uint256 royaltyAmountWei,
        uint256 sellerAmountWei
    );

    constructor() ERC721("JYiTengNFT", "JNFT") Ownable() {}

    /// @notice 铸造一个不设置版税的新 NFT。
    /// @param to 新铸造 NFT 的接收地址。
    /// @param uri 写入 Token 的元数据 URI。
    /// @return tokenId 新铸造的 Token ID。
    function safeMint(address to, string memory uri) external returns (uint256) {
        return safeMint(to, uri, address(0), 0);
    }

    /// @notice 铸造一个可选设置 EIP-2981 版税的新 NFT。
    /// @dev 当 royaltyReceiver 为零地址且 royaltyFeeBps 不为 0 时，接收者 to 会作为版税接收方。
    /// @param to 新铸造 NFT 的接收地址。
    /// @param uri 写入 Token 的元数据 URI。
    /// @param royaltyReceiver 可选版税接收方；零地址表示使用 to。
    /// @param royaltyFeeBps 版税比例，单位为基点；0 表示不为该 Token 设置版税。
    /// @return tokenId 新铸造的 Token ID。
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

    /// @notice 铸造给调用者，并立即按链原生代币价格上架。
    /// @param uri 写入 Token 的元数据 URI。
    /// @param priceWei 精确上架价格，单位为 wei。
    /// @return tokenId 新铸造并已上架的 Token ID。
    function mintAndList(string memory uri, uint256 priceWei) external returns (uint256) {
        return mintAndList(uri, priceWei, address(0), 0);
    }

    /// @notice 在一笔交易中为调用者铸造 Token 并完成上架。
    /// @dev 只有铸造和版税配置都成功后，才会创建上架信息。
    /// @param uri 写入 Token 的元数据 URI。
    /// @param priceWei 精确上架价格，单位为 wei。
    /// @param royaltyReceiver 可选版税接收方；零地址表示使用铸造者。
    /// @param royaltyFeeBps 版税比例，单位为基点；0 表示不为该 Token 设置版税。
    /// @return tokenId 新铸造并已上架的 Token ID。
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

    /// @notice 将调用者拥有的 Token 按固定价格上架出售。
    /// @dev 对同一个 Token 重新上架会覆盖已有上架信息。
    /// @param tokenId 要上架的 Token ID。
    /// @param priceWei 精确上架价格，单位为 wei。
    function listToken(uint256 tokenId, uint256 priceWei) external {
        require(_exists(tokenId), "token not found");
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(priceWei > 0, "price must be > 0");

        _listings[tokenId] = Listing({seller: msg.sender, priceWei: priceWei, active: true});
        emit Listed(tokenId, msg.sender, priceWei);
    }

    /// @notice 取消调用者创建的有效上架。
    /// @param tokenId 要移除上架信息的 Token ID。
    function cancelListing(uint256 tokenId) external {
        Listing memory listing = _listings[tokenId];
        require(listing.active, "not listed");
        require(listing.seller == msg.sender, "not seller");

        delete _listings[tokenId];
        emit Delisted(tokenId, msg.sender);
    }

    /// @notice 使用链原生代币购买一个有效上架的 Token。
    /// @dev 要求精确付款；先转移 NFT，再分配版税和卖家成交款。
    /// @param tokenId 要购买的 Token ID。
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

    /// @notice 返回某个 Token 当前的上架状态。
    /// @dev 过期上架会返回未激活，而不是直接回滚。
    /// @param tokenId 要查询的 Token ID。
    /// @return seller 已保存的卖家地址；没有有效上架时返回零地址。
    /// @return priceWei 已保存的上架价格，单位为 wei；没有有效上架时返回 0。
    /// @return active 只有上架有效且卖家仍拥有该 Token 时才返回 true。
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

    /// @notice 返回某个 Token 在指定成交价下的版税信息。
    /// @param tokenId 要查询的 Token ID。
    /// @param salePriceWei 用于计算版税金额的成交价，单位为 wei。
    /// @return receiver 该 Token 的版税接收方。
    /// @return royaltyAmount 根据 salePriceWei 计算出的版税金额。
    /// @return royaltyFeeBps 已保存的版税比例，单位为基点。
    function getRoyaltyInfo(
        uint256 tokenId,
        uint256 salePriceWei
    ) external view returns (address receiver, uint256 royaltyAmount, uint96 royaltyFeeBps) {
        require(_exists(tokenId), "token not found");
        (receiver, royaltyAmount) = royaltyInfo(tokenId, salePriceWei);
        royaltyFeeBps = _tokenRoyaltyBps[tokenId];
    }

    /// @notice 返回本合约已铸造的 Token 数量。
    /// @return 已铸造 Token 总数；已销毁 Token 仍会计入。
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @dev 在铸造后配置单个 Token 的版税状态。
    /// @param tokenId 要配置版税状态的 Token ID。
    /// @param fallbackReceiver royaltyReceiver 为零地址时使用的接收方。
    /// @param royaltyReceiver 明确指定的版税接收方；零地址表示使用 fallbackReceiver。
    /// @param royaltyFeeBps 版税比例，单位为基点；0 会清除该 Token 的版税状态。
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

    /// @dev Token 被销毁时，清理元数据、版税读取数据和上架状态。
    function _burn(
        uint256 tokenId
    ) internal override(ERC721URIStorage, ERC721Royalty) {
        super._burn(tokenId);
        delete _tokenRoyaltyBps[tokenId];
        delete _listings[tokenId];
    }

    /// @notice 返回某个 Token 的元数据 URI。
    /// @dev ERC721 和 ERC721URIStorage 都定义了 tokenURI，因此需要显式重写。
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    /// @notice 查询本合约是否实现指定接口。
    /// @dev ERC721URIStorage 和 ERC721Royalty 都重写了 supportsInterface，因此需要显式重写。
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
 mapping(uint256 => Listing) private _listings;

    /// @dev 保存原始版税基点，方便外部读取；ERC721Royalty 本身不暴露该值。
    mapping(uint256 => uint96) private _tokenRoyaltyBps;