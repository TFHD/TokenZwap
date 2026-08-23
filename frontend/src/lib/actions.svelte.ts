import { isAddress, type TransactionResponse } from 'ethers';
import {
	ensureAllowance,
	ensureNftApproval,
	nftContract,
	runTx,
	signerContracts
} from './amm.svelte';
import { parseAmount, sameAddress } from './format';
import { pool } from './state.svelte';
import { LP_DECIMALS, type Listing } from './types';

export async function swap(tokenInIsA: boolean, amount: string) {
	await runTx('Swap confirmed.', async () => {
		const { signer, amm, tokenA, tokenB } = await signerContracts();
		const parsed = parseAmount(amount, tokenInIsA ? pool.decimalsA : pool.decimalsB);
		await ensureAllowance(tokenInIsA ? tokenA : tokenB, await signer.getAddress(), parsed);
		return (await amm.swap(tokenInIsA ? pool.tokenA : pool.tokenB, parsed)) as TransactionResponse;
	});
}

export async function addLiquidity(amountA: string, amountB: string) {
	await runTx('Liquidity added.', async () => {
		const { signer, amm, tokenA, tokenB } = await signerContracts();
		const owner = await signer.getAddress();
		const parsedA = parseAmount(amountA, pool.decimalsA);
		const parsedB = parseAmount(amountB, pool.decimalsB);
		await ensureAllowance(tokenA, owner, parsedA);
		await ensureAllowance(tokenB, owner, parsedB);
		return (await amm.addLiquidity(parsedA, parsedB)) as TransactionResponse;
	});
}

export async function removeLiquidity(lpAmount: string) {
	await runTx('Liquidity removed.', async () => {
		const { amm } = await signerContracts();
		const parsed = parseAmount(lpAmount, LP_DECIMALS, 'LP amount');
		return (await amm.removeLiquidity(parsed)) as TransactionResponse;
	});
}

export async function listNFT(
	nftAddress: string,
	tokenId: string,
	paymentIsA: boolean,
	price: string
) {
	await runTx('NFT listed.', async () => {
		if (!isAddress(nftAddress)) throw new Error('Invalid NFT contract address.');
		const { signer, amm } = await signerContracts();
		const owner = await signer.getAddress();
		const id = BigInt(tokenId);
		const parsedPrice = parseAmount(
			price,
			paymentIsA ? pool.decimalsA : pool.decimalsB,
			'price'
		);

		const nft = nftContract(nftAddress, signer);
		if (!sameAddress((await nft.ownerOf(id)) as string, owner)) {
			throw new Error('You do not own this NFT.');
		}
		await ensureNftApproval(nft, owner, id);

		return (await amm.listNFT(
			nftAddress,
			id,
			paymentIsA ? pool.tokenA : pool.tokenB,
			parsedPrice
		)) as TransactionResponse;
	});
}

export async function buyNFT(listing: Listing) {
	await runTx('NFT purchased.', async () => {
		const { signer, amm, tokenA, tokenB } = await signerContracts();
		const token = sameAddress(listing.paymentToken, pool.tokenA) ? tokenA : tokenB;
		await ensureAllowance(token, await signer.getAddress(), listing.price);
		return (await amm.buyNFT(listing.id)) as TransactionResponse;
	});
}

export async function cancelListing(listingId: number) {
	await runTx('Listing cancelled.', async () => {
		const { amm } = await signerContracts();
		return (await amm.cancelListing(listingId)) as TransactionResponse;
	});
}
