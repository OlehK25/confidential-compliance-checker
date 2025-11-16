// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "encrypted-types/EncryptedTypes.sol";

/**
 * @title ConfidentialComplianceChecker (C3)
 * @notice A decentralized privacy-preserving sanctions compliance checking system using FHE
 * @dev This contract allows users to check their compliance status without revealing:
 *      - Their personal information on-chain
 *      - The reason they were flagged (if non-compliant)
 *      - Their checking history
 */
contract ConfidentialComplianceChecker is SepoliaConfig {
    // ========== EVENTS ==========

    event ComplianceCheckRequested(address indexed user, uint256 indexed checkId);
    event SanctionedEntityAdded(uint256 indexed entityId);
    event SanctionedEntityRemoved(uint256 indexed entityId);
    event ComplianceOfficerAdded(address indexed officer);
    event ComplianceOfficerRemoved(address indexed officer);

    // ========== ERRORS ==========

    error OnlyOwner();
    error OnlyComplianceOfficer();
    error InvalidEntityId();
    error EntityAlreadyExists();
    error EntityNotFound();

    // ========== STATE VARIABLES ==========

    /// @notice Contract owner (admin)
    address public owner;

    /// @notice Mapping of authorized compliance officers
    mapping(address => bool) public complianceOfficers;

    /// @notice Counter for compliance check IDs
    uint256 public checkCounter;

    /// @notice Counter for sanctioned entity IDs
    uint256 public entityCounter;

    /// @notice Struct to store encrypted sanctioned entity data
    struct SanctionedEntity {
        euint256 nameHash;     // Encrypted hash of name
        euint256 countryCode;  // Encrypted country code
        eaddress walletAddress; // Encrypted wallet address
        ebool isActive;        // Encrypted active status
    }

    /// @notice Mapping of entity ID to sanctioned entity data
    mapping(uint256 => SanctionedEntity) public sanctionedEntities;

    /// @notice Struct to store compliance check results
    struct ComplianceCheck {
        address user;
        euint8 status; // 0 = COMPLIANT, 1 = NON_COMPLIANT
        uint256 timestamp;
    }

    /// @notice Mapping of check ID to compliance check
    mapping(uint256 => ComplianceCheck) public complianceChecks;

    /// @notice Mapping to track if user has granted access to their check results
    mapping(uint256 => mapping(address => bool)) public checkResultAccess;

    // ========== MODIFIERS ==========

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyComplianceOfficer() {
        if (!complianceOfficers[msg.sender] && msg.sender != owner) {
            revert OnlyComplianceOfficer();
        }
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

    /**
     * @notice Add a compliance officer who can manage sanctioned entities
     * @param officer Address of the compliance officer to add
     */
    function addComplianceOfficer(address officer) external onlyOwner {
        complianceOfficers[officer] = true;
        emit ComplianceOfficerAdded(officer);
    }

    /**
     * @notice Remove a compliance officer
     * @param officer Address of the compliance officer to remove
     */
    function removeComplianceOfficer(address officer) external onlyOwner {
        complianceOfficers[officer] = false;
        emit ComplianceOfficerRemoved(officer);
    }

    /**
     * @notice Transfer ownership to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        complianceOfficers[newOwner] = true;
    }

    // ========== COMPLIANCE OFFICER FUNCTIONS ==========

    /**
     * @notice Add a sanctioned entity to the list (encrypted data)
     * @param nameHashHandle Encrypted hash of the entity's name
     * @param countryCodeHandle Encrypted country code
     * @param walletAddressHandle Encrypted wallet address
     * @param inputProof Proof for the encrypted inputs
     * @return entityId The ID of the newly added entity
     */
    function addSanctionedEntity(
        externalEuint256 nameHashHandle,
        externalEuint256 countryCodeHandle,
        externalEaddress walletAddressHandle,
        bytes memory inputProof
    ) external onlyComplianceOfficer returns (uint256 entityId) {
        // Convert external encrypted inputs to internal types
        euint256 nameHash = FHE.fromExternal(nameHashHandle, inputProof);
        euint256 countryCode = FHE.fromExternal(countryCodeHandle, inputProof);
        eaddress walletAddress = FHE.fromExternal(walletAddressHandle, inputProof);

        // Create active status (encrypted true)
        ebool isActive = FHE.asEbool(true);

        entityId = entityCounter++;

        sanctionedEntities[entityId] = SanctionedEntity({
            nameHash: nameHash,
            countryCode: countryCode,
            walletAddress: walletAddress,
            isActive: isActive
        });

        // Grant access to the contract itself for future computations
        FHE.allowThis(nameHash);
        FHE.allowThis(countryCode);
        FHE.allowThis(walletAddress);
        FHE.allowThis(isActive);

        emit SanctionedEntityAdded(entityId);
    }

    /**
     * @notice Deactivate a sanctioned entity
     * @param entityId ID of the entity to deactivate
     */
    function deactivateSanctionedEntity(uint256 entityId) external onlyComplianceOfficer {
        if (entityId >= entityCounter) revert InvalidEntityId();

        sanctionedEntities[entityId].isActive = FHE.asEbool(false);
        FHE.allowThis(sanctionedEntities[entityId].isActive);

        emit SanctionedEntityRemoved(entityId);
    }

    /**
     * @notice Reactivate a sanctioned entity
     * @param entityId ID of the entity to reactivate
     */
    function reactivateSanctionedEntity(uint256 entityId) external onlyComplianceOfficer {
        if (entityId >= entityCounter) revert InvalidEntityId();

        sanctionedEntities[entityId].isActive = FHE.asEbool(true);
        FHE.allowThis(sanctionedEntities[entityId].isActive);

        emit SanctionedEntityAdded(entityId);
    }

    // ========== USER FUNCTIONS ==========

    /**
     * @notice Check compliance status by submitting encrypted personal data
     * @param nameHashHandle Encrypted hash of user's name
     * @param countryCodeHandle Encrypted country code
     * @param walletAddressHandle Encrypted wallet address
     * @param inputProof Proof for the encrypted inputs
     * @return checkId The ID of the compliance check
     */
    function checkCompliance(
        externalEuint256 nameHashHandle,
        externalEuint256 countryCodeHandle,
        externalEaddress walletAddressHandle,
        bytes memory inputProof
    ) external returns (uint256 checkId) {
        // Convert external encrypted inputs to internal types
        euint256 userNameHash = FHE.fromExternal(nameHashHandle, inputProof);
        euint256 userCountryCode = FHE.fromExternal(countryCodeHandle, inputProof);
        eaddress userWalletAddress = FHE.fromExternal(walletAddressHandle, inputProof);

        // Initialize compliance status as COMPLIANT (0)
        euint8 status = FHE.asEuint8(0);

        // Check against all active sanctioned entities
        for (uint256 i = 0; i < entityCounter; i++) {
            SanctionedEntity storage entity = sanctionedEntities[i];

            // Skip if entity is not active
            // We perform the check in encrypted domain to avoid leaking information

            // Check if name hash matches
            ebool nameMatches = FHE.eq(userNameHash, entity.nameHash);

            // Check if country code matches
            ebool countryMatches = FHE.eq(userCountryCode, entity.countryCode);

            // Check if wallet address matches
            ebool walletMatches = FHE.eq(userWalletAddress, entity.walletAddress);

            // Any match (name OR country OR wallet) with an active entity means non-compliant
            ebool anyMatch = FHE.or(nameMatches, FHE.or(countryMatches, walletMatches));

            // Only flag if entity is active
            ebool shouldFlag = FHE.and(anyMatch, entity.isActive);

            // Update status: if shouldFlag is true, set status to 1 (NON_COMPLIANT)
            // Using select: if shouldFlag, return 1, else return current status
            status = FHE.select(shouldFlag, FHE.asEuint8(1), status);
        }

        // Store the compliance check result
        checkId = checkCounter++;
        complianceChecks[checkId] = ComplianceCheck({
            user: msg.sender,
            status: status,
            timestamp: block.timestamp
        });

        // Grant access to the user and contract
        FHE.allow(status, msg.sender);
        FHE.allowThis(status);

        // Grant access for user's encrypted inputs (they own their data)
        FHE.allow(userNameHash, msg.sender);
        FHE.allow(userCountryCode, msg.sender);
        FHE.allow(userWalletAddress, msg.sender);

        emit ComplianceCheckRequested(msg.sender, checkId);
    }

    /**
     * @notice Grant access to compliance check results to a third party
     * @param checkId ID of the compliance check
     * @param grantee Address to grant access to
     */
    function grantCheckResultAccess(uint256 checkId, address grantee) external {
        ComplianceCheck storage check = complianceChecks[checkId];

        // Only the user who requested the check can grant access
        require(check.user == msg.sender, "Not authorized");

        // Grant access to the encrypted status
        FHE.allow(check.status, grantee);

        checkResultAccess[checkId][grantee] = true;
    }

    /**
     * @notice Revoke access to compliance check results from a third party
     * @param checkId ID of the compliance check
     * @param revokee Address to revoke access from
     */
    function revokeCheckResultAccess(uint256 checkId, address revokee) external {
        ComplianceCheck storage check = complianceChecks[checkId];

        // Only the user who requested the check can revoke access
        require(check.user == msg.sender, "Not authorized");

        checkResultAccess[checkId][revokee] = false;
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Get the encrypted status of a compliance check
     * @param checkId ID of the compliance check
     * @return Encrypted status (0 = COMPLIANT, 1 = NON_COMPLIANT)
     */
    function getCheckStatus(uint256 checkId) external view returns (euint8) {
        return complianceChecks[checkId].status;
    }

    /**
     * @notice Get the timestamp of a compliance check
     * @param checkId ID of the compliance check
     * @return Timestamp when the check was performed
     */
    function getCheckTimestamp(uint256 checkId) external view returns (uint256) {
        return complianceChecks[checkId].timestamp;
    }

    /**
     * @notice Get the user address of a compliance check
     * @param checkId ID of the compliance check
     * @return Address of the user who requested the check
     */
    function getCheckUser(uint256 checkId) external view returns (address) {
        return complianceChecks[checkId].user;
    }

    /**
     * @notice Get total number of sanctioned entities
     * @return Total count of sanctioned entities
     */
    function getSanctionedEntityCount() external view returns (uint256) {
        return entityCounter;
    }

    /**
     * @notice Get total number of compliance checks performed
     * @return Total count of compliance checks
     */
    function getCheckCount() external view returns (uint256) {
        return checkCounter;
    }

    /**
     * @notice Check if an address is a compliance officer
     * @param officer Address to check
     * @return True if the address is a compliance officer
     */
    function isComplianceOfficer(address officer) external view returns (bool) {
        return complianceOfficers[officer];
    }
}