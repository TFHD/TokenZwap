import { Contract, MaxUint256, type ContractRunner, type TransactionResponse } from 'ethers';
import { AMM_ABI, ERC20_ABI, ERC721_ABI } from './abi';
import { AMM_ADDRESS, isConfigured } from './chain';
import { browserProvider, readProvider } from './ethereum';
import { parseError } from './errors';
import { parseAmount, sameAddress, tryParseAmount } from './format';
import { applyPool, isSepolia, pool, wallet } from './state.svelte';
import { INITIAL_POOL, type Listing, type Pool } from './types';

function ammAt(runner: ContractRunner) {
	return new Contract(AMM_ADDRESS, AMM_ABI, runner);
}

function erc20At(address: string, runner: ContractRunner) {
	return new Contract(address, ERC20_ABI, runner);
}

export async function signerContracts() {
	if (!isConfigured()) throw new Error('Missing AMM address in .env (PUBLIC_AMM_ADDRESS).');
	if (!isSepolia()) throw new Error('Switch to the Sepolia network.');

	const provider = browserProvider();
	const signer = await provider.getSigner();
	const amm = ammAt(signer);
	const tokenA = erc20At(pool.tokenA || (await amm.tokenA()), signer);
	const tokenB = erc20At(pool.tokenB || (await amm.tokenB()), signer);
	return { signer, amm, tokenA, tokenB };
}

export async function ensureAllowance(token: Contract, owner: string, amount: bigint) {
	const current = (await token.allowance(owner, AMM_ADDRESS)) as bigint;
	if (current >= amount) return;
	const tx = (await token.approve(AMM_ADDRESS, MaxUint256)) as TransactionResponse;
	wallet.lastTx = tx.hash;
	await tx.wait();
}

export async function ensureNftApproval(nft: Contract, owner: string, tokenId: bigint) {
	const approved = (await nft.getApproved(tokenId)) as string;
	const approvedAll = (await nft.isApprovedForAll(owner, AMM_ADDRESS)) as boolean;
	if (sameAddress(approved, AMM_ADDRESS) || approvedAll) return;
	const tx = (await nft.approve(AMM_ADDRESS, tokenId)) as TransactionResponse;
	wallet.lastTx = tx.hash;
	await tx.wait();
}

export function nftContract(address: string, runner: ContractRunner) {
	return new Contract(address, ERC721_ABI, runner);
}

export async function runTx(label: string, action: () => Promise<TransactionResponse | void>) {
	wallet.busy = true;
	wallet.error = null;
	wallet.lastTx = null;
	wallet.lastMessage = null;

	try {
		const tx = await action();
		if (tx) {
			wallet.lastTx = tx.hash;
			await tx.wait();
		}
		wallet.lastMessage = label;
		await refreshPool();
	} catch (error) {
		wallet.error = parseError(error);
	} finally {
		wallet.busy = false;
	}
}

function toListing(row: {
	seller: string;
	nftContract: string;
	tokenId: bigint;
	paymentToken: string;
	price: bigint;
	active: boolean;
}, id: number): Listing {
	return {
		id,
		seller: row.seller,
		nftContract: row.nftContract,
		tokenId: row.tokenId.toString(),
		paymentToken: row.paymentToken,
		price: row.price,
		active: row.active
	};
}

async function loadPool(): Promise<{ name: string; data: Pool }> {
	const provider = readProvider();
	const amm = ammAt(provider);
	const account = wallet.account;

	const [tokenAAddr, tokenBAddr, reserves, feePercent, totalLP, listingCount, name] =
		await Promise.all([
			amm.tokenA() as Promise<string>,
			amm.tokenB() as Promise<string>,
			amm.getReserves() as Promise<[bigint, bigint]>,
			amm.feePercent() as Promise<bigint>,
			amm.totalSupply() as Promise<bigint>,
			amm.listingCount() as Promise<bigint>,
			amm.name() as Promise<string>
		]);

	const tokenA = erc20At(tokenAAddr, provider);
	const tokenB = erc20At(tokenBAddr, provider);
	const zero = Promise.resolve(0n);

	const [symbolA, symbolB, decimalsA, decimalsB, userA, userB, userLP, rawListings] =
		await Promise.all([
			tokenA.symbol() as Promise<string>,
			tokenB.symbol() as Promise<string>,
			tokenA.decimals() as Promise<number>,
			tokenB.decimals() as Promise<number>,
			account ? (tokenA.balanceOf(account) as Promise<bigint>) : zero,
			account ? (tokenB.balanceOf(account) as Promise<bigint>) : zero,
			account ? (amm.balanceOf(account) as Promise<bigint>) : zero,
			Promise.all(
				Array.from({ length: Number(listingCount) }, (_, id) => amm.listings(id))
			)
		]);

	return {
		name: name || 'TokenZwap',
		data: {
			...INITIAL_POOL,
			tokenA: tokenAAddr,
			tokenB: tokenBAddr,
			symbolA,
			symbolB,
			decimalsA: Number(decimalsA),
			decimalsB: Number(decimalsB),
			feePercent: Number(feePercent),
			reserveA: reserves[0],
			reserveB: reserves[1],
			totalLP,
			userA,
			userB,
			userLP,
			listings: rawListings.map(toListing)
		}
	};
}

export async function refreshPool() {
	if (!isConfigured()) return;
	try {
		const { name, data } = await loadPool();
		applyPool(data);
		wallet.name = name;
	} catch (error) {
		wallet.error = parseError(error);
	}
}

export async function quoteOut(tokenInIsA: boolean, amount: string) {
	if (!isConfigured() || !pool.tokenA) return 0n;
	const parsed = tryParseAmount(amount, tokenInIsA ? pool.decimalsA : pool.decimalsB);
	if (!parsed) return 0n;
	try {
		const amm = ammAt(readProvider());
		return (await amm.getAmountOut(tokenInIsA ? pool.tokenA : pool.tokenB, parsed)) as bigint;
	} catch {
		return 0n;
	}
}
