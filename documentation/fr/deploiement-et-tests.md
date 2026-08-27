# Déployer et tester l’AMM

## Prérequis

- Node.js 20+ et npm
- Un wallet avec de l’ETH Sepolia (gas)
- Une RPC Sepolia (Alchemy, Infura, PublicNode, …)
- MetaMask pour tester la DApp
- Optionnel : clé API Etherscan pour vérifier les contrats

## Structure du repo

```
TZ/
├── code/           Contrats Solidity + Hardhat 3
├── deployment/     Script de déploiement (AMMdeploy.ts)
├── frontend/       DApp SvelteKit
└── documentation/
```

## 1. Installer les dépendances Hardhat

```bash
cd code
chmod +x install.sh
./install.sh
```

`install.sh` lance `npm i` puis crée le lien `deployment/node_modules` → `code/node_modules` (le script de deploy importe Hardhat depuis ce dossier).

## 2. Variables d’environnement (contrats)

Créer `code/.env` (jamais commité) :

```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0xVOTRE_CLE_PRIVEE
ETHERSCAN_API_KEY=votre_cle_etherscan
```

`hardhat.config.ts` lit `SEPOLIA_RPC_URL`, `PRIVATE_KEY` et `ETHERSCAN_API_KEY` via `configVariable` + `dotenv`.

> Ne jamais committer une clé privée. Le `.gitignore` racine ignore déjà `.env`.



## 3. Compiler

```bash
cd code
npm run compile
```

Solidity `0.8.20`. Artefacts dans `code/artifacts/` (ignorés par git).

## 4. Déployer sur Sepolia

Le script `deployment/AMMdeploy.ts` :

1. Déploie `SabarthoTokenA` et `SabarthoTokenB` avec **1 000 000** tokens chacun (si `DEPLOY_TOKENS = true`).
2. Déploie `AMSSabartho(tokenA, tokenB, 2)` — frais **2 %**.

```bash
cd code
npm run deploy
```

Équivalent : `hardhat run ../deployment/AMMdeploy.ts --network sepolia`.

Le script affiche les trois adresses. Déploiement actuel :


| Contrat | Adresse                                      |
| ------- | -------------------------------------------- |
| Token A | `0xDe8AA58Ba90119a11bF5d571Afef6faEdcC98F38` |
| Token B | `0xBD06a1aa6eD26A7B8d5a13F2B208f813A802D184` |
| AMM     | `0x5be75E6e0a1ab73F3E02355C1Cd2BB91D0cAc368` |


Pour réutiliser des tokens déjà déployés : passer `DEPLOY_TOKENS` à `false` et renseigner `TOKEN_A_ADDRESS` / `TOKEN_B_ADDRESS` dans l’environnement. Le script actuel appelle `tokenA.getAddress()` sans `await` si les tokens viennent d’être déployés : garder `DEPLOY_TOKENS = true` pour le chemin testé, ou corriger le script avant de relier des tokens existants.

## 5. Vérifier sur Etherscan (optionnel)

Exemple Token B (script npm existant) :

```bash
cd code
npx hardhat verify --network sepolia \
  --contract contracts/TokenBSBT.sol:SabarthoTokenB \
  0xBD06a1aa6eD26A7B8d5a13F2B208f813A802D184 \
  1000000
```

Token A : même commande avec `TokenASBT.sol:SabarthoTokenA` et l’adresse A.

AMM (constructeur : adresse A, adresse B, frais) :

```bash
npx hardhat verify --network sepolia \
  --contract contracts/AMM.sol:AMSSabartho \
  0x5be75E6e0a1ab73F3E02355C1Cd2BB91D0cAc368 \
  0xDe8AA58Ba90119a11bF5d571Afef6faEdcC98F38 \
  0xBD06a1aa6eD26A7B8d5a13F2B208f813A802D184 \
  2
```



## 6. Lancer la DApp

```bash
cd frontend
npm install
```

`frontend/.env` (déjà aligné sur le déploiement Sepolia) :

```env
PUBLIC_AMM_ADDRESS=0x5be75E6e0a1ab73F3E02355C1Cd2BB91D0cAc368
```

Un `.env.example` est fourni. Puis :

```bash
npm run dev
```

Ouvrir l’URL Vite (souvent `http://localhost:5173`). Connecter MetaMask, réseau **Sepolia**.

Importer les tokens dans MetaMask (custom token) :

- SBTA : `0xDe8AA58Ba90119a11bF5d571Afef6faEdcC98F38`
- SBTB : `0xBD06a1aa6eD26A7B8d5a13F2B208f813A802D184`
- AMMLP : `0x5be75E6e0a1ab73F3E02355C1Cd2BB91D0cAc368`

Le déployeur possède le supply initial. Pour un second wallet de test : transférer des SBTA/SBTB, ou minter (`mint` réservé à l’owner).

## Plan de test manuel

Il n’y a pas de suite de tests automatisés (Hardhat/Mocha) dans le repo. Valider sur Sepolia comme suit.

### A. Lecture seule (onglet Pool)

1. Sans wallet : l’onglet **Pool** charge quand même réserves, frais, supply LP.
2. Vérifier que le contrat affiché correspond à `0x2C52…826a`.
3. Si le pool est vide, les prix spot affichent « — ».



### B. Wallet et réseau

1. Sans MetaMask : message d’installation.
2. Connecter, puis tester le bouton **Switch to Sepolia** depuis un autre réseau.
3. Déconnecter : les soldes utilisateur reviennent à 0, le pool reste visible.



### C. Liquidité

1. Premier dépôt (pool vide) : entrer A et B dans le ratio voulu — ce ratio **fixe le prix initial**. Recevoir `√(A × B)` AMMLP.
2. Dépôt suivant : la DApp suggère le montant B pour coller au ratio. Un surplus n’est **pas remboursé**.
3. MetaMask : deux `approve` (si besoin) puis `addLiquidity`.
4. Onglet **Remove** : prévisualiser A/B récupérés, brûler des LP, vérifier les soldes.



### D. Swap

1. Entrer un montant : la sortie vient de `getAmountOut` (pas un calcul local).
2. Contrôler frais (2 %), impact prix (vert / ambre / rouge) et **slippage max** (0,5 % / 1 % / 3 %). **Min received** = `quoted × (1 − slippage)`.
3. Inverser la paire (↕), relancer un quote.
4. Confirmer : `approve` du token d’entrée si l’allowance est insuffisante, puis `swap(..., minAmountOut, deadline)` (`deadline` = now + 20 min, affiché **Expires**).
5. Lien **Etherscan** après confirmation. Les réserves et le prix spot doivent bouger.



### E. Marketplace NFT

Prérequis : un ERC-721 Sepolia dont vous êtes owner, et assez de SBTA/SBTB pour l’achat.

1. **List** : adresse du contrat NFT, tokenId, prix, monnaie (SBTA ou SBTB). `approve` NFT puis `listNFT`. Le NFT est en escrow dans l’AMM.
2. Aperçu image via `tokenURI` (HTTP / IPFS / data URI).
3. **Buy** depuis un autre compte : `approve` ERC-20 puis `buyNFT`. Le vendeur reçoit les tokens, l’acheteur le NFT. On ne peut pas acheter sa propre listing.
4. **Cancel** : seul le vendeur récupère le NFT.



### F. Cas d’erreur à vérifier


| Action                                   | Résultat attendu                                 |
| ---------------------------------------- | ------------------------------------------------ |
| Swap montant 0                           | Revert `Amount must be > 0`                      |
| Token d’entrée invalide                  | Revert `Invalid token`                           |
| Swap plus grand que la réserve de sortie | Revert `Insufficient liquidity`                  |
| Sortie sous le min (slippage trop serré) | Revert `slippage too high`                       |
| Deadline déjà passée                     | Revert `Deadline expired`                        |
| Retrait LP > solde                       | Revert `Not enough LP tokens`                    |
| Listing prix 0                           | Revert `Price must be > 0`                       |
| Listing d’un NFT non possédé             | Revert / erreur DApp « You do not own this NFT » |
| Acheter sa propre listing                | Revert `Cannot buy your own NFT`                 |


