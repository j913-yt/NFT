const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);

  const Factory = await hre.ethers.getContractFactory("NFTCollection");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("NFTCollection deployed to:", addr);

  // 简单自检：读一下 totalMinted
  const minted = await contract.totalMinted();
  console.log("totalMinted:", minted.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

