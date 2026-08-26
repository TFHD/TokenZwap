export type Listing = {
	id: number;
	seller: string;
	nftContract: string;
	tokenId: string;
	paymentToken: string;
	price: bigint;
	active: boolean;
};

export type PricePoint = {
	timestamp: number;
	price: number;
	reserveA: string;
	reserveB: string;
	txHash?: string;
};

export type ToastKind = 'success' | 'error' | 'info' | 'price';

export type Toast = {
	id: number;
	kind: ToastKind;
	title: string;
	message?: string;
	href?: string;
};

export type Wallet = {
	account: string | null;
	chainId: number | null;
	name: string;
	connecting: boolean;
	switching: boolean;
	busy: boolean;
	error: string | null;
	lastTx: string | null;
	lastMessage: string | null;
	hasProvider: boolean;
};

export type Pool = {
	tokenA: string;
	tokenB: string;
	symbolA: string;
	symbolB: string;
	decimalsA: number;
	decimalsB: number;
	feePercent: number;
	reserveA: bigint;
	reserveB: bigint;
	totalLP: bigint;
	userA: bigint;
	userB: bigint;
	userLP: bigint;
	listings: Listing[];
};

export const LP_DECIMALS = 18;

export const INITIAL_WALLET: Wallet = {
	account: null,
	chainId: null,
	name: 'TokenZwap',
	connecting: false,
	switching: false,
	busy: false,
	error: null,
	lastTx: null,
	lastMessage: null,
	hasProvider: false
};

export const INITIAL_POOL: Pool = {
	tokenA: '',
	tokenB: '',
	symbolA: 'A',
	symbolB: 'B',
	decimalsA: 18,
	decimalsB: 18,
	feePercent: 0,
	reserveA: 0n,
	reserveB: 0n,
	totalLP: 0n,
	userA: 0n,
	userB: 0n,
	userLP: 0n,
	listings: []
};
