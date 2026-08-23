# Contract explanations

Three contracts: two teaching ERC-20s and one contract that is the **AMM vault**, the **LP token**, and the **NFT escrow**.

![Constant product](../diagrams/constant-product.svg)

## 1. `SabarthoTokenA` / `SabarthoTokenB`

Files: `code/contracts/TokenASBT.sol`, `TokenBSBT.sol`.

OpenZeppelin ERC-20 + `Ownable`.

| | Token A | Token B |
| --- | --- | --- |
| Name | 42 Sabartho Token A | 42 Sabartho Token B |
| Symbol | SBTA | SBTB |
| Decimals | 18 | 18 |
| Sepolia address | `0xC736b5BC9C484f275E8B0E3B4e4eb174Ed3D94EB` | `0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46` |

**Constructor**: `initialSupply` in whole tokens (e.g. `1_000_000`). The contract mints `initialSupply * 10**18` to `msg.sender`, who becomes owner.

**`mint(to, amount)`**: `onlyOwner`. `amount` is in the smallest unit (token-wei), not human tokens.

They have no AMM logic. The AMM treats them as `IERC20` via `SafeERC20`.

## 2. `AMSSabartho` — overview

File: `code/contracts/AMM.sol`. Address: `0x2C525A01fC50864B110cb23cF600DEAEB9Be826a`.

Inherits:

- `ERC20("AMM LP Token", "AMMLP")` — pool shares *are* this token
- `IERC721Receiver` — accepts NFT `safeTransferFrom`
- `ReentrancyGuard` — `nonReentrant` on every state-changing function
- `Ownable` — owner = deployer (no business `onlyOwner` function in this file)

Constructor: `(_tokenA, _tokenB, _feePercent)`

- tokens non-zero and distinct
- `feePercent` ∈ [1, 10]
- `tokenA` and `tokenB` are immutable; `feePercent` is public and never updated

Pool state: `reserveA`, `reserveB` (internal accounting, updated on deposit / withdraw / swap).

## 3. Liquidity

![Liquidity flow](../diagrams/liquidity-flow.svg)

```mermaid
flowchart TD
  A[addLiquidity amountA amountB] --> P[safeTransferFrom A and B]
  P --> Z{totalSupply == 0 ?}
  Z -->|yes| S["lp = sqrt(A * B)"]
  Z -->|no| M["lp = min(A * tot / resA, B * tot / resB)"]
  S --> U[reserves += A, B · mint LP]
  M --> U
  R[removeLiquidity lp] --> C["A,B = lp / tot * reserves"]
  C --> B2[burn LP · reserves -= · transfer]
```

### `addLiquidity(amountA, amountB) → lpMinted`

1. Both amounts must be > 0.
2. The contract pulls A and B from the caller (`approve` required).
3. **First LP** (`totalSupply() == 0`): `lpMinted = sqrt(amountA * amountB)` (geometric mean, Babylonian `sqrt`). The A/B ratio **sets the price**.
4. **Later deposits**: mint the weaker of the two valuations so the depositor is never credited above the thin side:
   - `lpFromA = amountA * totalLP / reserveA`
   - `lpFromB = amountB * totalLP / reserveB`
5. **Both** amounts are added to reserves. Surplus on the strong side stays in the pool (no refund).
6. `_mint(msg.sender, lpMinted)` · event `LiquidityAdded`.

### `removeLiquidity(lpAmount) → (amountA, amountB)`

Pro-rata claim on both reserves:

```
amountA = lpAmount * reserveA / totalLP
amountB = lpAmount * reserveB / totalLP
```

Spot price is unchanged; `k = reserveA * reserveB` falls. Burn, then `safeTransfer` both tokens. Event `LiquidityRemoved`.

Swap fees sit in the reserves: every LP realizes a share when they exit.

## 4. Swap (constant product)

![Swap flow](../diagrams/swap-flow.svg)

Model: **x · y = k**. Spot prices:

- 1 A in B = `reserveB / reserveA`
- 1 B in A = `reserveA / reserveB`

### `swap(tokenIn, amountIn) → amountOut`

1. `tokenIn` must be A or B, `amountIn > 0`.
2. `safeTransferFrom` of `amountIn` into the pool.
3. Quote (same as `getAmountOut`):

```
inFee = getFeeAmount(amountIn) = amountIn * feePercent / 100
amountOut = inFee * reserveOut / (reserveIn + inFee)
```

4. `amountOut` must be > 0 and strictly less than the output reserve.
5. The **full** `amountIn` is added to the input reserve; `amountOut` is subtracted from the output reserve.
6. Transfer the output token · event `Swapped`.

With `feePercent = 2`, `getFeeAmount` returns **2%** of the input. That slice — not 98% — is what the quote uses. The remaining 98% still enters the input reserve (LP revenue). This is **not** a classic Uniswap-style 2% fee. See [Known limitations](limitations.md).

There is no `minAmountOut` and no deadline: slippage is not capped on-chain. The DApp only shows an informational price impact.

### Views

- `getReserves()` → `(reserveA, reserveB)`
- `getAmountOut(tokenIn, amountIn)` → same formula as `swap`, no state change

## 5. Fixed-price NFT marketplace

![NFT marketplace](../diagrams/nft-marketplace.svg)

Independent from the AMM curve. The seller sets the price in SBTA or SBTB.

```solidity
struct Listing {
    address seller;
    address nftContract;
    uint256 tokenId;
    address paymentToken; // A or B only
    uint256 price;
    bool active;
}
```

`listings[id]`, `listingCount` (increments, never reused).

### `listNFT(nftContract, tokenId, paymentToken, price) → listingId`

- `price > 0`, `paymentToken` is A or B
- `ownerOf(tokenId) == msg.sender`
- `safeTransferFrom` seller → AMM (escrow)
- Store listing + event `NFTListed`

The caller must `approve` the AMM on the NFT contract.

### `buyNFT(listingId)`

- Listing active, buyer ≠ seller
- Listing deactivated **before** transfers (prevents a double buy)
- ERC-20: buyer → **seller** (not the pool)
- NFT: AMM → buyer
- Event `NFTPurchased`

### `cancelListing(listingId)`

Seller only. Listing inactive, NFT returned. Event `NFTListingCancelled`.

### `onERC721Received`

Returns the ERC-721 selector. Without it, `safeTransferFrom` into the AMM would revert.

## 6. Events

| Event | When |
| --- | --- |
| `LiquidityAdded` | deposit + LP mint |
| `LiquidityRemoved` | LP burn + withdrawals |
| `Swapped` | A↔B trade |
| `NFTListed` | new escrow |
| `NFTPurchased` | sale |
| `NFTListingCancelled` | seller cancel |

## 7. Frontend role

The DApp does not recompute the quote locally: it calls `getAmountOut`. It also:

- connects MetaMask / switches to Sepolia (`chainId` 11155111)
- `approve`s ERC-20 with `MaxUint256` when allowance is too low
- `approve`s the ERC-721 before `listNFT`
- suggests amount B (`amountA * reserveB / reserveA`)
- previews LP withdrawal
- computes a local price-impact hint (quote vs spot)
- loads listings `0 .. listingCount-1`
- resolves NFT media from `tokenURI` (IPFS gateways)
