# How to deploy and test the AMM

## Requirements

- Node.js 20+ and npm
- A wallet with Sepolia ETH (gas)
- A Sepolia RPC (Alchemy, Infura, PublicNode, …)
- MetaMask to exercise the DApp
- Optional: Etherscan API key to verify contracts

## Repo layout

```
TZ/
├── code/           Solidity contracts + Hardhat 3
├── deployment/     Deploy script (AMMdeploy.ts)
├── frontend/       SvelteKit DApp
└── documentation/
```

## 1. Install Hardhat dependencies

```bash
cd code
chmod +x install.sh
./install.sh
```

`install.sh` runs `npm i` and symlinks `deployment/node_modules` → `code/node_modules` (the deploy script imports Hardhat from that folder).

## 2. Contract environment

Create `code/.env` (never commit it):

```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=your_etherscan_key
```

`hardhat.config.ts` reads `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, and `ETHERSCAN_API_KEY` through `configVariable` + `dotenv`.

> Never commit a private key. The root `.gitignore` already ignores `.env`.



## 3. Compile

```bash
cd code
npm run compile
```

Solidity `0.8.20`. Artifacts land in `code/artifacts/` (gitignored).

## 4. Deploy to Sepolia

`deployment/AMMdeploy.ts`:

1. Deploys `SabarthoTokenA` and `SabarthoTokenB` with **1,000,000** tokens each (when `DEPLOY_TOKENS = true`).
2. Deploys `AMSSabartho(tokenA, tokenB, 2)` — **2%** fee.

```bash
cd code
npm run deploy
```

Equivalent: `hardhat run ../deployment/AMMdeploy.ts --network sepolia`.

The script prints the three addresses. Current deployment:


| Contract | Address                                      |
| -------- | -------------------------------------------- |
| Token A  | `0xC736b5BC9C484f275E8B0E3B4e4eb174Ed3D94EB` |
| Token B  | `0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46` |
| AMM      | `0x2C525A01fC50864B110cb23cF600DEAEB9Be826a` |


To reuse existing tokens: set `DEPLOY_TOKENS` to `false` and provide `TOKEN_A_ADDRESS` / `TOKEN_B_ADDRESS`. The current script calls `tokenA.getAddress()` without `await` on a fresh deploy; keep `DEPLOY_TOKENS = true` for the tested path, or fix the script before wiring existing tokens.

## 5. Verify on Etherscan (optional)

Token B example (existing npm script target):

```bash
cd code
npx hardhat verify --network sepolia \
  --contract contracts/TokenBSBT.sol:SabarthoTokenB \
  0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46 \
  1000000
```

Token A: same command with `TokenASBT.sol:SabarthoTokenA` and the A address.

AMM (constructor: address A, address B, fee):

```bash
npx hardhat verify --network sepolia \
  --contract contracts/AMM.sol:AMSSabartho \
  0x2C525A01fC50864B110cb23cF600DEAEB9Be826a \
  0xC736b5BC9C484f275E8B0E3B4e4eb174Ed3D94EB \
  0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46 \
  2
```



## 6. Run the DApp

```bash
cd frontend
npm install
```

`frontend/.env` (already pointed at the Sepolia deploy):

```env
PUBLIC_AMM_ADDRESS=0x2C525A01fC50864B110cb23cF600DEAEB9Be826a
```

A `.env.example` is provided. Then:

```bash
npm run dev
```

Open the Vite URL (often `http://localhost:5173`). Connect MetaMask on **Sepolia**.

Import tokens in MetaMask (custom token):

- SBTA: `0xC736b5BC9C484f275E8B0E3B4e4eb174Ed3D94EB`
- SBTB: `0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46`
- AMMLP: `0x2C525A01fC50864B110cb23cF600DEAEB9Be826a`

The deployer holds the initial supply. For a second test wallet: transfer SBTA/SBTB, or mint (`mint` is owner-only).

## Manual test plan

There is no automated Hardhat/Mocha suite in the repo. Validate on Sepolia as follows.

### A. Read-only (Pool tab)

1. Without a wallet, **Pool** still loads reserves, fee, and LP supply.
2. Check that the shown contract matches `0x2C52…826a`.
3. Empty pool: spot prices show “—”.



### B. Wallet and network

1. No MetaMask: install prompt.
2. Connect, then use **Switch to Sepolia** from another chain.
3. Disconnect: user balances reset to 0; pool data stays visible.



### C. Liquidity

1. First deposit (empty pool): pick A and B — that ratio **sets the initial price**. You receive `√(A × B)` AMMLP.
2. Later deposit: the DApp suggests B to match the ratio. Surplus is **not refunded**.
3. MetaMask: two `approve`s if needed, then `addLiquidity`.
4. **Remove**: preview A/B out, burn LP, check balances.



### D. Swap

1. Enter an amount: output comes from `getAmountOut` (not a local formula).
2. Check fee (2%) and price impact (green / amber / red).
3. Flip the pair (↕) and quote again.
4. Confirm: `approve` the input token if allowance is low, then `swap`.
5. **Etherscan** link after confirmation. Reserves and spot price should move.



### E. NFT marketplace

Need: a Sepolia ERC-721 you own, and enough SBTA/SBTB to buy.

1. **List**: NFT contract, tokenId, price, currency (SBTA or SBTB). NFT `approve` then `listNFT`. The NFT is escrowed in the AMM.
2. Image preview from `tokenURI` (HTTP / IPFS / data URI).
3. **Buy** from another account: ERC-20 `approve` then `buyNFT`. Seller gets tokens, buyer gets the NFT. You cannot buy your own listing.
4. **Cancel**: only the seller gets the NFT back.



### F. Error cases


| Action                          | Expected                                |
| ------------------------------- | --------------------------------------- |
| Swap amount 0                   | Revert `Amount must be > 0`             |
| Invalid input token             | Revert `Invalid token`                  |
| Swap larger than output reserve | Revert `Insufficient liquidity`         |
| Remove more LP than balance     | Revert `Not enough LP tokens`           |
| List with price 0               | Revert `Price must be > 0`              |
| List an NFT you do not own      | Revert / DApp “You do not own this NFT” |
| Buy your own listing            | Revert `Cannot buy your own NFT`        |


