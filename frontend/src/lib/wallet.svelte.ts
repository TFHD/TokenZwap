import { browser } from '$app/environment';
import { refreshPool } from './amm.svelte';
import { SEPOLIA } from './chain';
import { browserProvider, getEthereum } from './ethereum';
import { parseError } from './errors';
import { resetUserBalances, wallet } from './state.svelte';

async function sync() {
	const provider = browserProvider();
	const signer = await provider.getSigner();
	wallet.account = await signer.getAddress();
	wallet.chainId = Number((await provider.getNetwork()).chainId);
	await refreshPool();
}

export async function connect() {
	const eth = getEthereum();
	if (!eth) {
		wallet.error = 'MetaMask is not installed.';
		return;
	}

	wallet.connecting = true;
	wallet.error = null;

	try {
		await browserProvider().send('eth_requestAccounts', []);
		await sync();
	} catch (error) {
		wallet.error = parseError(error);
	} finally {
		wallet.connecting = false;
	}
}

export function disconnect() {
	wallet.account = null;
	wallet.lastTx = null;
	wallet.lastMessage = null;
	wallet.error = null;
	resetUserBalances();
}

export async function switchToSepolia() {
	const eth = getEthereum();
	if (!eth) {
		wallet.error = 'MetaMask is not installed.';
		return;
	}

	wallet.switching = true;
	wallet.error = null;

	try {
		await eth.request?.({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: SEPOLIA.chainIdHex }]
		});
	} catch (error) {
		const e = error as { code?: number };
		if (e.code !== 4902) {
			wallet.error = parseError(error);
			return;
		}
		try {
			await eth.request?.({
				method: 'wallet_addEthereumChain',
				params: [
					{
						chainId: SEPOLIA.chainIdHex,
						chainName: SEPOLIA.name,
						nativeCurrency: SEPOLIA.nativeCurrency,
						rpcUrls: [SEPOLIA.rpcUrl],
						blockExplorerUrls: [SEPOLIA.explorer]
					}
				]
			});
		} catch (addError) {
			wallet.error = parseError(addError);
		}
	} finally {
		wallet.switching = false;
	}
}

async function restore() {
	const eth = getEthereum();
	if (!eth) {
		void refreshPool();
		return;
	}

	try {
		const provider = browserProvider();
		const accounts = await provider.send('eth_accounts', []);
		wallet.chainId = Number((await provider.getNetwork()).chainId);
		if (accounts[0]) await sync();
		else void refreshPool();
	} catch {
		void refreshPool();
	}
}

if (browser) {
	wallet.hasProvider = Boolean(window.ethereum);
	void restore();

	const eth = getEthereum();
	eth?.on?.('accountsChanged', (accounts: unknown) => {
		const list = Array.isArray(accounts) ? (accounts as string[]) : [];
		wallet.account = list[0] ?? null;
		wallet.error = null;
		void refreshPool();
	});
	eth?.on?.('chainChanged', (chainId: unknown) => {
		wallet.chainId = typeof chainId === 'string' ? Number.parseInt(chainId, 16) : null;
		wallet.error = null;
		void refreshPool();
	});
}
