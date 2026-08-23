# Limites connues

Projet pédagogique sur Sepolia, pas un protocole de production.

## Frais de swap non standards

`getFeeAmount` renvoie la **tranche de frais** (`amount * feePercent / 100`), et `swap` utilise cette valeur comme entrée effective du quote :

```
amountOut = getFeeAmount(amountIn) * reserveOut / (reserveIn + getFeeAmount(amountIn))
```

Avec `feePercent = 2`, seulement **2 %** de l’entrée sert à calculer la sortie. Les **98 %** restants sont quand même ajoutés à la réserve d’entrée (revenu LP). Un AMM type Uniswap v2 utiliserait plutôt `amountIn * (100 - fee) / 100` (soit 98 % pour le quote).

Conséquence : les swaps sont beaucoup plus coûteux qu’un « frais 2 % » classique. La DApp affiche `Fee 2%`, ce qui décrit le paramètre on-chain, pas un take-rate Uniswap.

## Pas de protection de slippage

`swap` n’a ni `minAmountOut` ni `deadline`. Entre le quote et la confirmation, un autre swap peut déplacer le prix. L’utilisateur reçoit ce que la courbe donne au moment de l’inclusion, éventuellement beaucoup moins. L’impact prix dans l’UI est indicatif.

## Dépôt déséquilibré : pas de refund

`addLiquidity` encaisse A et B en entier, mais ne mint que `min(lpFromA, lpFromB)`. Le surplus du côté fort reste dans le pool et dilue implicitement le déposant. La DApp suggère le ratio, elle ne le force pas.

## Premier mint LP et overflow

`sqrt(amountA * amountB)` : en Solidity 0.8, un produit trop grand revert. Pas de `sqrt` type Uniswap (`sqrt(a*b) - MINIMUM_LIQUIDITY`) ni de liquidité minimale brûlée à l’adresse zéro : le premier LP peut théoriquement vider le pool plus tard.

## Comptabilité des réserves

`reserveA` / `reserveB` sont incrémentées des montants passés en argument, pas relues via `balanceOf`. Un transfert ERC-20 direct vers l’AMM (donation) n’entre pas dans les réserves et peut désynchroniser `balanceOf(pool)` vs `reserve*`. Les paiements NFT ne touchent pas ces réserves (correct).

## Marketplace NFT

- Prix fixé par le vendeur, **aucune** liaison avec le prix AMM.
- Pas de royalty, pas de frais de marché.
- `listingCount` ne fait que croître ; les listings inactives restent en storage.
- La DApp recharge **toutes** les listings à chaque refresh (`0 .. listingCount-1`) : ça ne scale pas.
- Tout ERC-721 est accepté ; un contrat malveillant peut se comporter de façon inattendue.
- Pas de vente aux enchères, pas d’offre, pas de listing partielle.

## Tokens

- `mint` owner-only : un testeur sans transfert / mint n’a pas de SBTA/SBTB.
- Pas de `burn` public, pas de cap.
- `Ownable` sur l’AMM n’expose aucune action métier (seulement `transferOwnership` hérité).

## Frontend / ops

- Pas de tests automatisés (Hardhat/Mocha/Foundry).
- RPC publique hardcodée pour les lectures ; dépendance de disponibilité.
- `approve(MaxUint256)` : allowance infinie à l’AMM après le premier usage d’un token.
- Script `AMMdeploy.ts` : `tokenA.getAddress()` n’est pas `await` ; le chemin `DEPLOY_TOKENS = false` n’est pas fiable tel quel.
- Le script npm `verify` ne cible que Token B.
- Pas d’oracle TWAP, pas de flash-loan guard dédié (seul `nonReentrant`).
- Réseau Sepolia uniquement.

## Ce que le projet assume

- Utilisateurs honnêtes sur un testnet.
- Tokens A/B standard (pas de fee-on-transfer : un tel token casserait les réserves).
- ETH Sepolia disponible pour le gas.
