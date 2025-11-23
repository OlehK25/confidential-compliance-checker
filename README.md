# 🔐 C3 - Confidential Compliance Checker

> Privacy-Preserving Sanctions Verification using Zama's Fully Homomorphic Encryption

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue.svg)](https://soliditylang.org/)
[![Zama FHE](https://img.shields.io/badge/Zama-FHE-purple.svg)](https://zama.ai/)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-green.svg)](LICENSE)

---

## 💡 The Idea

**C3 (Confidential Compliance Checker)** is a decentralized privacy-preserving sanctions compliance verification system built with **Fully Homomorphic Encryption (FHE)** technology from Zama.

### The Problem
Traditional sanctions compliance systems expose users' personal data and reasons for blocking, violating privacy.

### The Solution
C3 allows users to check their compliance status **without revealing personal information on-chain**. All computations are performed on **encrypted data** using FHE.

### Key Benefits

✅ **Complete Privacy** - Personal data encrypted on-chain
✅ **FHE Technology** - Computation on encrypted data
✅ **No Data Leakage** - Reasons for non-compliance remain hidden
✅ **Role-Based Access** - User and Compliance Officer modes
✅ **Transparent Logging** - Full audit trail with privacy preservation
✅ **Futuristic UI** - Modern cyber-themed interface

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                     USER                             │
│   Submits encrypted: name, country, wallet          │
└─────────────────┬────────────────────────────────────┘
                  │
                  │ 1. Encrypt locally (FHE)
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│              SMART CONTRACT                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ Process encrypted data:                       │  │
│  │ - Compare with sanctioned list (encrypted)    │  │
│  │ - Return encrypted result                     │  │
│  │ - Never decrypt user data                     │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────┬────────────────────────────────────┘
                  │
                  │ 2. Return encrypted result
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│                  USER                                │
│  - Decrypt result locally                           │
│  - Learn compliance status                          │
│  - Privacy preserved! 🔒                            │
└──────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contract

**Deployed Contract (Sepolia):** `0x6bdFA72d65533c8981EBdC7096e470609BEA9E5D`

**Etherscan:** [View on Sepolia](https://sepolia.etherscan.io/address/0x6bdFA72d65533c8981EBdC7096e470609BEA9E5D)

### Core Functions

#### User Functions
```solidity
function checkCompliance(
    externalEuint256 nameHashHandle,
    externalEuint256 countryCodeHandle,
    externalEaddress walletAddressHandle,
    bytes memory inputProof
) external returns (uint256 checkId)
```

#### Officer Functions
```solidity
function addSanctionedEntity(
    externalEuint256 nameHashHandle,
    externalEuint256 countryCodeHandle,
    externalEaddress walletAddressHandle,
    bytes memory inputProof
) external returns (uint256 entityId)
```

### Data Structures

```solidity
struct SanctionedEntity {
    euint256 nameHash;      // Encrypted name hash
    euint256 countryCode;   // Encrypted country code
    eaddress walletAddress; // Encrypted wallet address
    ebool isActive;         // Encrypted active status
}

struct ComplianceCheck {
    address user;
    euint8 status;  // 0 = COMPLIANT, 1 = NON_COMPLIANT (encrypted)
    uint256 timestamp;
}
```

---

## 🎨 Frontend

### Features

- **🌌 Futuristic Cyber Theme**
  - Dark background with neon cyan/purple/pink accents
  - Animated hexagonal logo
  - Cyber grid background with particle effects
  - Smooth animations and transitions

- **📊 Real-Time Logging**
  - Color-coded log entries (info/success/warning/error)
  - Transaction hash tracking
  - Encryption/decryption process visibility

- **🔄 Three-Step Process**
  - 🔐 **Step 1:** Encrypt data locally
  - 📡 **Step 2:** Send transaction to blockchain
  - 🔓 **Step 3:** Decrypt result

- **👥 Role-Based Interface**
  - **User Mode:** Check compliance status
  - **Officer Mode:** Manage sanctioned entities

### Tech Stack

- **Frontend:** Vanilla JavaScript (ES6 modules)
- **Blockchain:** Ethers.js v6.15.0
- **FHE SDK:** Zama Relayer SDK v0.3.0-5
- **Smart Contracts:** Solidity 0.8.24 + Zama FHEVM
- **Network:** Ethereum Sepolia Testnet

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20+
- npm v7+
- MetaMask browser extension
- Sepolia testnet ETH ([Faucet](https://sepoliafaucet.com))

### 1. Clone Repository

```bash
git clone https://github.com/OlehK25/confidential-compliance-checker.git
cd confidential-compliance-checker
```

### 2. Install Dependencies

```bash
# Install contract dependencies
npm install

# Generate TypeScript types
npm run compile
```

### 3. Run Frontend (HTTPS Recommended)

**Option A: HTTPS Server** (supports EIP-712 signed decrypt)

```bash
cd frontend
node server.js
```

Open browser: **https://localhost:8443**

⚠️ Accept self-signed certificate in browser

**Option B: HTTP Server** (basic testing only)

```bash
cd frontend/public
python3 -m http.server 8080
```

Open browser: **http://localhost:8080**

### 4. Connect Wallet

1. Click **"Connect Wallet"**
2. Approve in MetaMask
3. Ensure you're on Sepolia testnet

### 5. Check Compliance (User Mode)

1. Fill the form:
   - **Full Name:** `John Doe`
   - **Country Code:** `US`
   - **Wallet Address:** `0x1234567890123456789012345678901234567890`

2. Click **"Check Compliance"**

3. Watch the three-step process:
   - 🔐 **Encrypt** → Data encryption
   - 📡 **Send TX** → Transaction submission
   - 🔓 **Decrypt** → Result decryption

4. See result: **✅ COMPLIANT** or **❌ NON-COMPLIANT**

### 6. Add Sanctioned Entity (Officer Mode)

1. Switch to **"Compliance Officer"** tab

2. Fill the form:
   - **Entity Name:** `Bad Actor`
   - **Country Code:** `KP`
   - **Wallet Address:** `0x0000000000000000000000000000000000000001`

3. Click **"Add Sanctioned Entity"**

4. Confirm transaction

5. Check that **Total Entities** increased

---

## 🧪 Testing Contract

### Compile Contracts

```bash
npm run compile
```

### Deploy to Sepolia

Create `.env` file:

```env
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
```

Deploy:

```bash
npx hardhat deploy --network sepolia
```

### Verify Contract

```bash
npx hardhat verify --network sepolia 0x6bdFA72d65533c8981EBdC7096e470609BEA9E5D
```

---

## 💻 Command Examples

### Smart Contract Deployment

```bash
# Compile contracts
npm run compile

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Frontend Development

```bash
# HTTPS server (recommended for signed decrypt)
cd frontend
node server.js

# HTTP server (basic testing only)
cd frontend/public
python3 -m http.server 8080
```

### Testing

```bash
# Run all tests
npm test

# Run with gas report
REPORT_GAS=true npm test

# Run coverage
npm run coverage
```

## 📁 Project Structure

```
confidential-compliance-checker/
├── contracts/
│   └── ConfidentialComplianceChecker.sol   # Main contract
├── frontend/
│   ├── server.js                            # HTTPS server (signed decrypt)
│   └── public/
│       └── index.html                       # Single-page application
├── deploy/
│   └── deploy.ts                            # Deployment script
├── test/
│   └── ConfidentialComplianceChecker.ts    # Tests
├── hardhat.config.ts                        # Hardhat config
├── package.json
└── README.md                                # This documentation
```

---

## 🔐 Security

### Privacy Guarantees

✅ Personal data never exposed on-chain
✅ Compliance check results encrypted
✅ Sanctioned entity list encrypted
✅ No data leakage through transaction analysis
✅ Reasons for non-compliance remain hidden

### Important Notes

⚠️ **TESTNET ONLY** - Zama Protocol Testnet is not audited
⚠️ **DO NOT** use for production without security audit
⚠️ **DO NOT** store real sensitive data

### Known Limitations

- High gas costs for FHE operations
- Decryption requires user signature
- Sepolia testnet only (mainnet support pending)

---

## 📸 Screenshots

### 👤 User Mode - Compliance Check
*Three-step process: Encrypt → Send TX → Decrypt*

<img width="1920" height="919" alt="image" src="https://github.com/user-attachments/assets/903a8b17-4ea6-4145-b5a1-3936bd7dfd53" />

### ⚔️ Officer Mode - Manage Sanctions
*Adding encrypted sanctioned entities*

<img width="1920" height="919" alt="image" src="https://github.com/user-attachments/assets/7680b688-c840-45ec-9e3d-8a372b181800" />

### 📊 Real-Time Logs
*Detailed logging with color indicators*

<img width="1920" height="919" alt="image" src="https://github.com/user-attachments/assets/fd2bed25-3798-4c30-86ae-04242cd9351c" />

---

## 📚 Documentation

- **Zama Docs:** https://docs.zama.ai
- **FHEVM Solidity:** https://docs.zama.ai/fhevm
- **Zama Relayer SDK:** https://docs.zama.ai/relayer-sdk
- **Ethers.js v6:** https://docs.ethers.org/v6

---

## 🛠️ Development

### Available Scripts

```bash
# Contract development
npm run compile      # Compile contracts
npm run test         # Run tests
npm run deploy       # Deploy to network
npm run clean        # Clean artifacts

# Frontend development (HTTPS recommended)
cd frontend
node server.js                      # HTTPS: https://localhost:8443

# Or HTTP (basic testing)
cd frontend/public
python3 -m http.server 8080        # HTTP: http://localhost:8080
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📝 License

**BSD-3-Clause-Clear License**

See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Zama** - For the incredible FHE technology
- **Ethereum Foundation** - For blockchain infrastructure
- **Hardhat** - For development framework

---

## 📞 Support

**Issues:** https://github.com/OlehK25/confidential-compliance-checker/issues
**Zama Discord:** https://discord.gg/zama
**Zama Docs:** https://docs.zama.ai

---

**🚀 Built with ❤️ using Zama FHE Technology**

---

## 🎯 Roadmap

- [ ] Mainnet deployment (pending Zama production release)
- [ ] Additional compliance categories
- [ ] Advanced entity search
- [ ] Batch compliance checks
- [ ] Multi-signature officer management
- [ ] Mobile responsive improvements
- [ ] Integration with other privacy protocols

---

**⭐ Like the project? Star it on GitHub!**