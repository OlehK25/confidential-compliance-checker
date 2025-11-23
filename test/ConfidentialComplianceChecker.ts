import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialComplianceChecker, ConfidentialComplianceChecker__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  officer: HardhatEthersSigner;
  user: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialComplianceChecker")) as ConfidentialComplianceChecker__factory;
  const contract = (await factory.deploy()) as ConfidentialComplianceChecker;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("ConfidentialComplianceChecker", function () {
  let signers: Signers;
  let contract: ConfidentialComplianceChecker;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], officer: ethSigners[1], user: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await contract.owner()).to.eq(signers.deployer.address);
    });

    it("should add deployer as compliance officer", async function () {
      expect(await contract.complianceOfficers(signers.deployer.address)).to.be.true;
    });

    it("should initialize counters to zero", async function () {
      expect(await contract.checkCounter()).to.eq(0);
      expect(await contract.entityCounter()).to.eq(0);
    });
  });

  describe("Access Control", function () {
    it("owner can add compliance officer", async function () {
      await contract.connect(signers.deployer).addComplianceOfficer(signers.officer.address);
      expect(await contract.complianceOfficers(signers.officer.address)).to.be.true;
    });

    it("owner can remove compliance officer", async function () {
      await contract.connect(signers.deployer).addComplianceOfficer(signers.officer.address);
      await contract.connect(signers.deployer).removeComplianceOfficer(signers.officer.address);
      expect(await contract.complianceOfficers(signers.officer.address)).to.be.false;
    });

    it("non-owner cannot add compliance officer", async function () {
      await expect(
        contract.connect(signers.user).addComplianceOfficer(signers.officer.address)
      ).to.be.revertedWith("not owner");
    });

    it("owner can transfer ownership", async function () {
      await contract.connect(signers.deployer).transferOwnership(signers.officer.address);
      expect(await contract.owner()).to.eq(signers.officer.address);
      expect(await contract.complianceOfficers(signers.officer.address)).to.be.true;
    });
  });

  describe("Sanctioned Entity Management", function () {
    it("compliance officer can add sanctioned entity", async function () {
      // Encrypt entity data
      const nameHash = BigInt("12345");
      const countryCode = BigInt("840"); // USA
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      const tx = await contract
        .connect(signers.deployer)
        .addSanctionedEntity(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await tx.wait();

      expect(await contract.entityCounter()).to.eq(1);
    });

    it("non-officer cannot add sanctioned entity", async function () {
      const nameHash = BigInt("12345");
      const countryCode = BigInt("840");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await expect(
        contract
          .connect(signers.user)
          .addSanctionedEntity(
            encrypted.handles[0],
            encrypted.handles[1],
            encrypted.handles[2],
            encrypted.inputProof
          )
      ).to.be.revertedWith("not officer");
    });

    it("can deactivate sanctioned entity", async function () {
      // Add entity first
      const nameHash = BigInt("12345");
      const countryCode = BigInt("840");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.deployer)
        .addSanctionedEntity(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      // Deactivate it
      await contract.connect(signers.deployer).deactivateSanctionedEntity(0);

      expect(await contract.entityCounter()).to.eq(1);
    });

    it("can reactivate sanctioned entity", async function () {
      // Add and deactivate entity
      const nameHash = BigInt("12345");
      const countryCode = BigInt("840");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.deployer)
        .addSanctionedEntity(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await contract.connect(signers.deployer).deactivateSanctionedEntity(0);

      // Reactivate it
      await contract.connect(signers.deployer).reactivateSanctionedEntity(0);

      expect(await contract.entityCounter()).to.eq(1);
    });
  });

  describe("Compliance Checks", function () {
    it("user can perform compliance check", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826"); // UK
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      const tx = await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await tx.wait();

      expect(await contract.checkCounter()).to.eq(1);
    });

    it("compliance check returns encrypted status", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      const status = await contract.getCheckStatus(0);
      expect(status).to.not.eq(ethers.ZeroHash);
    });

    it("can decrypt compliance status", async function () {
      // First, add a sanctioned entity
      const sanctionedNameHash = BigInt("99999");
      const sanctionedCountry = BigInt("643"); // Russia
      const sanctionedWallet = "0x1234567890123456789012345678901234567890";

      const sanctionEncrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(sanctionedNameHash)
        .add32(sanctionedCountry)
        .addAddress(sanctionedWallet)
        .encrypt();

      await contract
        .connect(signers.deployer)
        .addSanctionedEntity(
          sanctionEncrypted.handles[0],
          sanctionEncrypted.handles[1],
          sanctionEncrypted.handles[2],
          sanctionEncrypted.inputProof
        );

      // Now check a non-sanctioned user (should be COMPLIANT = 0)
      const userNameHash = BigInt("54321");
      const userCountry = BigInt("826");
      const userWallet = signers.user.address;

      const userEncrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(userNameHash)
        .add32(userCountry)
        .addAddress(userWallet)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          userEncrypted.handles[0],
          userEncrypted.handles[1],
          userEncrypted.handles[2],
          userEncrypted.inputProof
        );

      const encryptedStatus = await contract.getCheckStatus(0);
      const decryptedStatus = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        encryptedStatus,
        contractAddress,
        signers.user
      );

      // Status should be 0 (COMPLIANT) since user doesn't match sanctioned entity
      expect(decryptedStatus).to.eq(0);
    });

    it("user can grant access to check result", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await contract.connect(signers.user).grantCheckResultAccess(0, signers.officer.address);

      expect(await contract.checkResultAccess(0, signers.officer.address)).to.be.true;
    });

    it("user can revoke access to check result", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await contract.connect(signers.user).grantCheckResultAccess(0, signers.officer.address);
      await contract.connect(signers.user).revokeCheckResultAccess(0, signers.officer.address);

      expect(await contract.checkResultAccess(0, signers.officer.address)).to.be.false;
    });

    it("only check owner can grant access", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      await expect(
        contract.connect(signers.officer).grantCheckResultAccess(0, signers.officer.address)
      ).to.be.revertedWith("not authorized");
    });
  });

  describe("View Functions", function () {
    it("returns correct sanctioned entity count", async function () {
      expect(await contract.getSanctionedEntityCount()).to.eq(0);

      const nameHash = BigInt("12345");
      const countryCode = BigInt("840");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.deployer.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.deployer)
        .addSanctionedEntity(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      expect(await contract.getSanctionedEntityCount()).to.eq(1);
    });

    it("returns correct check count", async function () {
      expect(await contract.getCheckCount()).to.eq(0);

      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      expect(await contract.getCheckCount()).to.eq(1);
    });

    it("returns check user address", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      expect(await contract.getCheckUser(0)).to.eq(signers.user.address);
    });

    it("returns check timestamp", async function () {
      const nameHash = BigInt("54321");
      const countryCode = BigInt("826");
      const walletAddr = signers.user.address;

      const encrypted = await fhevm
        .createEncryptedInput(contractAddress, signers.user.address)
        .add32(nameHash)
        .add32(countryCode)
        .addAddress(walletAddr)
        .encrypt();

      const tx = await contract
        .connect(signers.user)
        .checkCompliance(
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.handles[2],
          encrypted.inputProof
        );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      expect(await contract.getCheckTimestamp(0)).to.eq(block!.timestamp);
    });

    it("checks if address is compliance officer", async function () {
      expect(await contract.isComplianceOfficer(signers.deployer.address)).to.be.true;
      expect(await contract.isComplianceOfficer(signers.user.address)).to.be.false;

      await contract.connect(signers.deployer).addComplianceOfficer(signers.officer.address);
      expect(await contract.isComplianceOfficer(signers.officer.address)).to.be.true;
    });

    it("returns protocol ID", async function () {
      expect(await contract.protocolId()).to.eq(42);
    });
  });
});
