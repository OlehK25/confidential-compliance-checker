// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, euint8, ebool, eaddress, externalEuint32, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ConfidentialComplianceChecker (C3)
 * @notice Privacy-preserving sanctions compliance checker using FHE
 * @dev Users can check compliance without revealing personal data on-chain
 */
contract ConfidentialComplianceChecker is ZamaEthereumConfig {
    // ========== STATE VARIABLES ==========
    
    address public owner;
    mapping(address => bool) public complianceOfficers;
    
    uint256 public checkCounter;
    uint256 public entityCounter;
    
    /// @notice Encrypted sanctioned entity data
    struct SanctionedEntity {
        euint32 nameHash;
        euint32 countryCode;
        eaddress walletAddress;
        ebool isActive;
    }
    
    mapping(uint256 => SanctionedEntity) public sanctionedEntities;
    
    /// @notice Compliance check result
    struct ComplianceCheck {
        address user;
        euint8 status; // 0 = COMPLIANT, 1 = NON_COMPLIANT
        uint256 timestamp;
    }
    
    mapping(uint256 => ComplianceCheck) public complianceChecks;
    mapping(uint256 => mapping(address => bool)) public checkResultAccess;
    
    // ========== EVENTS ==========
    
    event ComplianceCheckRequested(address indexed user, uint256 indexed checkId);
    event SanctionedEntityAdded(uint256 indexed entityId);
    event SanctionedEntityRemoved(uint256 indexed entityId);
    event ComplianceOfficerAdded(address indexed officer);
    event ComplianceOfficerRemoved(address indexed officer);
    
    // ========== MODIFIERS ==========
    
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    
    modifier onlyComplianceOfficer() {
        require(complianceOfficers[msg.sender] || msg.sender == owner, "not officer");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor() {
        owner = msg.sender;
        complianceOfficers[msg.sender] = true;
        checkCounter = 0;
        entityCounter = 0;
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    function addComplianceOfficer(address officer) external onlyOwner {
        complianceOfficers[officer] = true;
        emit ComplianceOfficerAdded(officer);
    }
    
    function removeComplianceOfficer(address officer) external onlyOwner {
        complianceOfficers[officer] = false;
        emit ComplianceOfficerRemoved(officer);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        complianceOfficers[newOwner] = true;
    }
    
    // ========== COMPLIANCE OFFICER FUNCTIONS ==========
    
    function addSanctionedEntity(
        externalEuint32 nameHashHandle,
        externalEuint32 countryCodeHandle,
        externalEaddress walletAddressHandle,
        bytes memory inputProof
    ) external onlyComplianceOfficer returns (uint256 entityId) {
        euint32 nameHash = FHE.fromExternal(nameHashHandle, inputProof);
        euint32 countryCode = FHE.fromExternal(countryCodeHandle, inputProof);
        eaddress walletAddress = FHE.fromExternal(walletAddressHandle, inputProof);
        ebool isActive = FHE.asEbool(true);
        
        entityId = entityCounter++;
        
        sanctionedEntities[entityId] = SanctionedEntity({
            nameHash: nameHash,
            countryCode: countryCode,
            walletAddress: walletAddress,
            isActive: isActive
        });
        
        FHE.allowThis(nameHash);
        FHE.allowThis(countryCode);
        FHE.allowThis(walletAddress);
        FHE.allowThis(isActive);
        
        emit SanctionedEntityAdded(entityId);
    }
    
    function deactivateSanctionedEntity(uint256 entityId) external onlyComplianceOfficer {
        require(entityId < entityCounter, "invalid entity");
        sanctionedEntities[entityId].isActive = FHE.asEbool(false);
        FHE.allowThis(sanctionedEntities[entityId].isActive);
        emit SanctionedEntityRemoved(entityId);
    }
    
    function reactivateSanctionedEntity(uint256 entityId) external onlyComplianceOfficer {
        require(entityId < entityCounter, "invalid entity");
        sanctionedEntities[entityId].isActive = FHE.asEbool(true);
        FHE.allowThis(sanctionedEntities[entityId].isActive);
        emit SanctionedEntityAdded(entityId);
    }
    
    // ========== USER FUNCTIONS ==========
    
    function checkCompliance(
        externalEuint32 nameHashHandle,
        externalEuint32 countryCodeHandle,
        externalEaddress walletAddressHandle,
        bytes memory inputProof
    ) external returns (uint256 checkId) {
        euint32 userNameHash = FHE.fromExternal(nameHashHandle, inputProof);
        euint32 userCountryCode = FHE.fromExternal(countryCodeHandle, inputProof);
        eaddress userWalletAddress = FHE.fromExternal(walletAddressHandle, inputProof);
        
        euint8 status = FHE.asEuint8(0); // Start as COMPLIANT
        
        // Check against all active sanctioned entities
        for (uint256 i = 0; i < entityCounter; i++) {
            SanctionedEntity storage entity = sanctionedEntities[i];
            
            ebool nameMatches = FHE.eq(userNameHash, entity.nameHash);
            ebool countryMatches = FHE.eq(userCountryCode, entity.countryCode);
            ebool walletMatches = FHE.eq(userWalletAddress, entity.walletAddress);
            
            ebool anyMatch = FHE.or(nameMatches, FHE.or(countryMatches, walletMatches));
            ebool shouldFlag = FHE.and(anyMatch, entity.isActive);
            
            status = FHE.select(shouldFlag, FHE.asEuint8(1), status);
        }
        
        checkId = checkCounter++;
        complianceChecks[checkId] = ComplianceCheck({
            user: msg.sender,
            status: status,
            timestamp: block.timestamp
        });
        
        FHE.allow(status, msg.sender);
        FHE.allowThis(status);
        FHE.allow(userNameHash, msg.sender);
        FHE.allow(userCountryCode, msg.sender);
        FHE.allow(userWalletAddress, msg.sender);
        
        emit ComplianceCheckRequested(msg.sender, checkId);
    }
    
    function grantCheckResultAccess(uint256 checkId, address grantee) external {
        require(complianceChecks[checkId].user == msg.sender, "not authorized");
        FHE.allow(complianceChecks[checkId].status, grantee);
        checkResultAccess[checkId][grantee] = true;
    }
    
    function revokeCheckResultAccess(uint256 checkId, address revokee) external {
        require(complianceChecks[checkId].user == msg.sender, "not authorized");
        checkResultAccess[checkId][revokee] = false;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getCheckStatus(uint256 checkId) external view returns (euint8) {
        return complianceChecks[checkId].status;
    }
    
    function getCheckTimestamp(uint256 checkId) external view returns (uint256) {
        return complianceChecks[checkId].timestamp;
    }
    
    function getCheckUser(uint256 checkId) external view returns (address) {
        return complianceChecks[checkId].user;
    }
    
    function getSanctionedEntityCount() external view returns (uint256) {
        return entityCounter;
    }
    
    function getCheckCount() external view returns (uint256) {
        return checkCounter;
    }
    
    function isComplianceOfficer(address officer) external view returns (bool) {
        return complianceOfficers[officer];
    }
    
    /// @notice Required by Zama protocol for contract identification
    function protocolId() external pure returns (uint256) {
        return 42; // Unique protocol identifier
    }
}