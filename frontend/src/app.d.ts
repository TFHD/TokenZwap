import type { Eip1193Provider } from 'ethers';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		ethereum?: Eip1193Provider & {
			isMetaMask?: boolean;
			on?(event: string, handler: (...args: unknown[]) => void): void;
			removeListener?(event: string, handler: (...args: unknown[]) => void): void;
			request?(args: { method: string; params?: unknown[] }): Promise<unknown>;
		};
	}
}

export {};
