# Known limitations

Teaching project on Sepolia, not production infrastructure.

## Residual sandwich (basic MEV only)

`swap` / `addLiquidity` / `removeLiquidity` take a unix `deadline`. The DApp sends **now + 20 minutes**. After that the tx reverts `Deadline expired`.

`minAmountOut` still caps how far a sandwich can push the price (revert `slippage too high`). A bot can still sandwich **just above** that floor. There is no private mempool, commit-reveal, or per-block swap lock. NFT `buyNFT` has neither deadline nor min-out.

Price impact in the UI is informational; the on-chain guards are `minAmountOut` and `deadline`.

## Unbalanced deposit: no refund

`addLiquidity` takes the full A and B amounts but mints only `min(lpFromA, lpFromB)`. Surplus on the strong side stays in the pool and implicitly dilutes the depositor. The DApp suggests the ratio; it does not enforce it.

## First LP mint and overflow

`sqrt(amountA * amountB)`: in Solidity 0.8 a huge product reverts. There is no Uniswap-style `sqrt(a*b) - MINIMUM_LIQUIDITY` and no minimum liquidity burned to the zero address: the first LP can later drain the pool.

## Reserve accounting

`reserveA` / `reserveB` increase by the function arguments, not by `balanceOf` reads. A raw ERC-20 transfer into the AMM (donation) never updates reserves and can desync `balanceOf(pool)` vs `reserve*`. NFT payments do not touch these reserves (correct).

## NFT marketplace

- Seller-set price, **no** link to the AMM price.
- No royalties, no market fee.
- `listingCount` only grows; inactive listings stay in storage.
- The DApp reloads **every** listing on each refresh (`0 .. listingCount-1`): this does not scale.
- Any ERC-721 is accepted; a hostile contract can behave unexpectedly.
- No auctions, no bids, no partial listings.

## Tokens

- `mint` is owner-only: a tester without a transfer / mint has no SBTA/SBTB.
- No public `burn`, no cap.
- `Ownable` on the AMM exposes no business action (only inherited `transferOwnership`).

## Frontend / ops

- No automated tests (Hardhat/Mocha/Foundry).
- Public RPC hardcoded for reads; availability is a dependency.
- `approve(MaxUint256)`: unlimited allowance to the AMM after first use of a token.
- `AMMdeploy.ts` does not `await` `tokenA.getAddress()`; the `DEPLOY_TOKENS = false` path is not reliable as written.
- The npm `verify` script only targets Token B.
- No TWAP oracle, no dedicated flash-loan guard (`nonReentrant` only).
- Sepolia only.

## Assumptions

- Honest users on a testnet.
- Standard A/B tokens (no fee-on-transfer: that would break reserves).
- Sepolia ETH available for gas.
