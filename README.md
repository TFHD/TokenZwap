# TokenZwap

DApp d’échange décentralisé sur **Ethereum Sepolia** : un AMM à produit constant (`x · y = k`) entre **SBTA** et **SBTB**, plus un marketplace NFT à prix fixe. Le contrat `AMSSabartho` est à la fois le vault du pool, le token LP (`AMMLP`) et l’escrow des NFT.

## Fonctionnalités

- **Swap** SBTA ↔ SBTB, quote on-chain, frais 2 %, impact prix affiché
- **Liquidité** : dépôt des deux tokens, mint d’AMMLP ; retrait proportionnel
- **Pool** : réserves, prix spot, supply LP, part de l’utilisateur
- **NFT** : listing / achat / annulation, paiement en SBTA ou SBTB (hors courbe AMM)

## Stack


| Couche   | Techno                                     |
| -------- | ------------------------------------------ |
| Contrats | Solidity 0.8.20, OpenZeppelin, Hardhat 3   |
| Frontend | SvelteKit, TypeScript, ethers v6, Tailwind |
| Réseau   | Sepolia (`11155111`) + MetaMask            |




## Contrats (Sepolia)


| Contrat          | Symbole | Adresse                                                                                                                         |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SabarthoTokenA` | SBTA    | `[0xC736b5BC9C484f275E8B0E3B4e4eb174Ed3D94EB](https://sepolia.etherscan.io/address/0x5b0dfDC1Bc91C9057E90620399A6D49FC117FD5A)` |
| `SabarthoTokenB` | SBTB    | `[0xC8e5d9A680d0edee5e42Ef8c10F3A3aBC8CD5C46](https://sepolia.etherscan.io/address/0xBD06a1aa6eD26A7B8d5a13F2B208f813A802D184)` |
| `AMSSabartho`    | AMMLP   | `[0x2C525A01fC50864B110cb23cF600DEAEB9Be826a](https://sepolia.etherscan.io/address/0x3D4DaA14Bfcd685da0578B181cea1A24a6E33FC7)` |




## Structure

```
TZ/
├── code/            Contrats Solidity + Hardhat
├── deployment/      Script de déploiement
├── frontend/        DApp SvelteKit
└── documentation/   Guide FR / EN, diagrammes, captures
```



## Démarrage rapide



### Contrats

```bash
cd code
./install.sh
```

Créer `code/.env` :

```env
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0xVOTRE_CLE_PRIVEE
ETHERSCAN_API_KEY=votre_cle_etherscan
```

```bash
npm run compile
npm run deploy    # déploie tokens + AMM sur Sepolia
```



### DApp

```bash
cd frontend
npm install
```

`frontend/.env` :

```env
PUBLIC_AMM_ADDRESS=0x2C525A01fC50864B110cb23cF600DEAEB9Be826a
```

```bash
npm run dev
```

Ouvrir l’URL Vite, connecter MetaMask sur **Sepolia**, importer SBTA / SBTB / AMMLP.

## Documentation

- [Français](documentation/fr/README.md) — déploiement, contrats, limites
- [English](documentation/en/README.md) — deploy & test, contracts, limitations

