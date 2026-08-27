import { formatAmount, tryParseAmount } from './format';
import { LP_DECIMALS, type Pool } from './types';

export function tokenMeta(pool: Pool, isA: boolean) {
	return isA
		? { address: pool.tokenA, symbol: pool.symbolA, decimals: pool.decimalsA, balance: pool.userA }
		: { address: pool.tokenB, symbol: pool.symbolB, decimals: pool.decimalsB, balance: pool.userB };
}

export function suggestedCounterAmount(amountA: string, pool: Pool) {
	if (pool.reserveA === 0n || pool.reserveB === 0n) return '';
	const parsedA = tryParseAmount(amountA, pool.decimalsA);
	if (!parsedA) return '';
	return formatAmount((parsedA * pool.reserveB) / pool.reserveA, pool.decimalsB);
}

export function withdrawPreview(lpAmount: string, pool: Pool) {
	if (pool.totalLP === 0n) return null;
	const parsed = tryParseAmount(lpAmount, LP_DECIMALS);
	if (!parsed) return null;
	return {
		a: (parsed * pool.reserveA) / pool.totalLP,
		b: (parsed * pool.reserveB) / pool.totalLP
	};
}

export function spotPriceBPerA(pool: Pool) {
	if (pool.reserveA === 0n) return '—';
	return formatAmount(
		(pool.reserveB * 10n ** BigInt(pool.decimalsA)) / pool.reserveA,
		pool.decimalsB
	);
}

export function spotPriceAPerB(pool: Pool) {
	if (pool.reserveB === 0n) return '—';
	return formatAmount(
		(pool.reserveA * 10n ** BigInt(pool.decimalsB)) / pool.reserveB,
		pool.decimalsA
	);
}

export function lpSharePercent(pool: Pool) {
	if (pool.totalLP === 0n || pool.userLP === 0n) return '0';
	return formatAmount((pool.userLP * 10n ** 18n * 100n) / pool.totalLP, 18, 4);
}

/** Floor of quoted output after a max slippage in basis points (100 bps = 1%). */
export function minAmountOut(quoted: bigint, slippageBps: number): bigint {
	if (quoted <= 0n) return 0n;
	const bps = BigInt(Math.max(0, Math.min(10_000, Math.floor(slippageBps))));
	return (quoted * (10_000n - bps)) / 10_000n;
}

export type PriceImpact = {
	percent: string;
	bps: bigint;
	level: 'low' | 'medium' | 'high';
};

export function priceImpact(
	amountIn: bigint,
	amountOut: bigint,
	reserveIn: bigint,
	reserveOut: bigint
): PriceImpact | null {
	if (amountIn <= 0n || amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) return null;
	const spotOut = (amountIn * reserveOut) / reserveIn;
	if (spotOut === 0n) return null;
	const lost = spotOut > amountOut ? spotOut - amountOut : 0n;
	const bps = (lost * 10000n) / spotOut;
	return {
		percent: formatAmount(bps, 2, 2),
		bps,
		level: bps < 100n ? 'low' : bps < 500n ? 'medium' : 'high'
	};
}
