import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";
import path from "path";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Auto-detect contract name from artifacts or use environment variable
  const contractName = process.env.CONTRACT_NAME || autoDetectContract(hre);

  if (!contractName) {
    throw new Error(
      "No contract found. Please specify CONTRACT_NAME environment variable or ensure contract is compiled.",
    );
  }

  console.log(`\n📋 Deploying: ${contractName}`);
  console.log(`👤 Deployer: ${deployer}\n`);

  // Parse constructor arguments
  let constructorArgs: any[] = [];
  if (process.env.CONSTRUCTOR_ARGS) {
    try {
      constructorArgs = JSON.parse(process.env.CONSTRUCTOR_ARGS);
      console.log(`🔧 Constructor args:`, constructorArgs);
    } catch (e) {
      console.error("Failed to parse CONSTRUCTOR_ARGS:", e);
      throw e;
    }
  } else {
    console.log(`ℹ️  No constructor args (default)`);
  }

  // Deploy contract
  const deployed = await deploy(contractName, {
    from: deployer,
    args: constructorArgs,
    log: true,
    waitConfirmations: process.env.WAIT_CONFIRMS ? parseInt(process.env.WAIT_CONFIRMS) : 1,
  });

  console.log(`\n✅ Deployed ${contractName} to: ${deployed.address}`);

  // Display constructor args if any
  if (constructorArgs.length > 0) {
    console.log(`📝 Constructor arguments:`, constructorArgs);

    // Special handling for EncryptedLottery ticket price
    if (contractName === "EncryptedLottery" && constructorArgs[0]) {
      const ethValue = hre.ethers.formatEther(constructorArgs[0]);
      console.log(`   Ticket Price: ${constructorArgs[0]} wei (${ethValue} ETH)`);
    }
  }

  console.log(
    `\n🔗 Verify with: npx hardhat verify --network ${hre.network.name} ${deployed.address}${constructorArgs.length > 0 ? ' "' + constructorArgs.join('" "') + '"' : ""}\n`,
  );
};

// Auto-detect contract from compiled artifacts
function autoDetectContract(hre: HardhatRuntimeEnvironment): string | null {
  const artifactsPath = path.join(hre.config.paths.artifacts, "contracts");

  if (!fs.existsSync(artifactsPath)) {
    return null;
  }

  const contracts: string[] = [];
  const files = fs.readdirSync(artifactsPath);

  for (const file of files) {
    const contractPath = path.join(artifactsPath, file);
    if (fs.statSync(contractPath).isDirectory()) {
      const jsonFiles = fs.readdirSync(contractPath).filter((f) => f.endsWith(".json") && !f.endsWith(".dbg.json"));
      for (const jsonFile of jsonFiles) {
        const contractName = jsonFile.replace(".json", "");
        // Skip interfaces and libraries
        if (
          !contractName.startsWith("I") &&
          contractName !== "ZamaEthereumConfig" &&
          contractName !== "ZamaGatewayConfig"
        ) {
          contracts.push(contractName);
        }
      }
    }
  }

  // If only one contract found, use it
  if (contracts.length === 1) {
    console.log(`🔍 Auto-detected contract: ${contracts[0]}`);
    return contracts[0];
  }

  // If multiple contracts, look for common patterns
  const priorityContracts = ["EncryptedLottery", "ConfidentialArtifactRegistry", "PrivateComplianceCheck"];
  for (const name of priorityContracts) {
    if (contracts.includes(name)) {
      console.log(`🔍 Auto-detected contract: ${name}`);
      return name;
    }
  }

  if (contracts.length > 1) {
    console.log(`⚠️  Multiple contracts found: ${contracts.join(", ")}`);
    console.log(`   Please specify CONTRACT_NAME environment variable`);
  }

  return contracts[0] || null;
}

export default func;
func.id = "deploy_universal";
func.tags = ["all"];
