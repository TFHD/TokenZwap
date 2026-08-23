import { browser } from '$app/environment';
import { BrowserProvider, JsonRpcProvider } from 'ethers';
import { SEPOLIA } from './chain';

export function getEthereum() {
	if (!browser) return undefined;
	return window.ethereum;
}

export function requireEthereum() {
	const eth = getEthereum();
	if (!eth) throw new Error('MetaMask is not installed.');
	return eth;
}

export function readProvider() {
	const eth = getEthereum();
	return eth ? new BrowserProvider(eth) : new JsonRpcProvider(SEPOLIA.rpcUrl);
}

export function browserProvider() {
	return new BrowserProvider(requireEthereum());
}
