import { SEPOLIA } from './chain';
import { INITIAL_POOL, INITIAL_WALLET, type Pool, type Wallet } from './types';

export const wallet = $state<Wallet>({ ...INITIAL_WALLET });
export const pool = $state<Pool>({ ...INITIAL_POOL });

export function isConnected() {
	return Boolean(wallet.account);
}

export function isSepolia() {
	return wallet.chainId === SEPOLIA.chainId;
}

export function resetUserBalances() {
	pool.userA = 0n;
	pool.userB = 0n;
	pool.userLP = 0n;
}

export function applyPool(next: Pool) {
	Object.assign(pool, next);
}
