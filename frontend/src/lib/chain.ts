import { env } from '$env/dynamic/public';
import { isAddress } from 'ethers';

export const AMM_ADDRESS = env.PUBLIC_AMM_ADDRESS ?? '';

export const TX_DEADLINE_SECS = 20 * 60;

export function txDeadline(): bigint {
	return BigInt(Math.floor(Date.now() / 1000) + TX_DEADLINE_SECS);
}

export const SEPOLIA = {
	chainId: 11155111,
	chainIdHex: '0xaa36a7',
	name: 'Sepolia',
	rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
	explorer: 'https://sepolia.etherscan.io',
	nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }
} as const;

export function isConfigured() {
	return isAddress(AMM_ADDRESS);
}

export function explorerTx(hash: string) {
	return `${SEPOLIA.explorer}/tx/${hash}`;
}
