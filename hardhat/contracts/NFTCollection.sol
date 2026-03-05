// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title 一个简单的平台级 NFT 合约，用于你的毕业设计商城
/// @notice 正常流程是：部署本合约 -> 前端调用 mint -> 后端记录 tokenId 等信息
contract NFTCollection is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event Minted(address indexed to, uint256 indexed tokenId, string tokenURI);

    // 在 OpenZeppelin 4.x 中，Ownable 的构造函数不接受参数，直接调用无参构造即可
    constructor() ERC721("GraduationNFT", "GNFT") Ownable() {}

    /// @notice 平台为某个地址铸造 NFT（也可以改成只有合约 owner 可以铸造）
    function safeMint(address to, string memory uri) external returns (uint256) {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
}

