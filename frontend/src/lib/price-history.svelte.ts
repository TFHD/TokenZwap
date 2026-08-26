import { Contract, formatUnits, type EventLog } from 'ethers';
import { AMM_ABI } from './abi';
import { AMM_ADDRESS, SEPOLIA, isConfigured } from './chain';
import { readProvider } from './ethereum';
import { parseError } from './errors';
import { pool } from './state.svelte';
import { pushToast } from './toast.svelte';
import type { PricePoint } from './types';

const LOOKBACK_BLOCKS = 80_000;
const CHUNK = 8_000;

export const priceHistory = $state<{
	points: PricePoint[];
	loading: boolean;
	error: string | null;
	listening: boolean;
}>({
	points: [],
	loading: false,
	error: null,
	listening: false
});

let listenerContract: Contract | null = null;
let lastNotifiedPrice: number | null = null;

function humanPrice(reserveA: bigint, reserveB: bigint, priceAinB: bigint): number {
	const decimalsA = pool.decimalsA || 18;
	const decimalsB = pool.decimalsB || 18;
	if (reserveA > 0n) {
		const scaled = (reserveB * 10n ** BigInt(decimalsA)) / reserveA;
		return Number(formatUnits(scaled, decimalsB));
	}
	return Number(formatUnits(priceAinB, 18));
}

function toPoint(
	timestamp: bigint,
	reserveA: bigint,
	reserveB: bigint,
	priceAinB: bigint,
	txHash?: string
): PricePoint {
	return {
		timestamp: Number(timestamp),
		price: humanPrice(reserveA, reserveB, priceAinB),
		reserveA: reserveA.toString(),
		reserveB: reserveB.toString(),
		txHash
	};
}

function upsertPoint(point: PricePoint) {
	const points = priceHistory.points;
	const last = points[points.length - 1];
	if (last && last.timestamp === point.timestamp && last.price === point.price) {
		if (point.txHash) last.txHash = point.txHash;
		return false;
	}
	points.push(point);
	if (points.length > 500) points.splice(0, points.length - 500);
	return true;
}

function seedFromPool() {
	if (pool.reserveA === 0n || pool.reserveB === 0n) return;
	if (priceHistory.points.length > 0) return;
	const price = humanPrice(pool.reserveA, pool.reserveB, 0n);
	priceHistory.points.push({
		timestamp: Math.floor(Date.now() / 1000),
		price,
		reserveA: pool.reserveA.toString(),
		reserveB: pool.reserveB.toString()
	});
	lastNotifiedPrice = price;
}

async function queryChunk(amm: Contract, fromBlock: number, toBlock: number) {
	const filter = amm.filters.PriceUpdated();
	const logs = (await amm.queryFilter(filter, fromBlock, toBlock)) as EventLog[];
	const points: PricePoint[] = [];
	for (const log of logs) {
		const args = log.args;
		if (!args) continue;
		points.push(
			toPoint(
				args.timestamp as bigint,
				args.reserveA as bigint,
				args.reserveB as bigint,
				args.priceAinB as bigint,
				log.transactionHash
			)
		);
	}
	return points;
}

export async function loadPriceHistory() {
	if (!isConfigured()) return;
	priceHistory.loading = true;
	priceHistory.error = null;

	try {
		const provider = readProvider();
		const amm = new Contract(AMM_ADDRESS, AMM_ABI, provider);
		const latest = await provider.getBlockNumber();
		const from = Math.max(0, latest - LOOKBACK_BLOCKS);
		const collected: PricePoint[] = [];

		for (let start = from; start <= latest; start += CHUNK) {
			const end = Math.min(start + CHUNK - 1, latest);
			try {
				const chunk = await queryChunk(amm, start, end);
				collected.push(...chunk);
			} catch {
				// Some public RPCs reject large eth_getLogs ranges; skip chunk.
			}
		}

		collected.sort((a, b) => a.timestamp - b.timestamp || a.price - b.price);
		priceHistory.points = collected;
		seedFromPool();
		const last = priceHistory.points[priceHistory.points.length - 1];
		lastNotifiedPrice = last?.price ?? null;
	} catch (error) {
		priceHistory.error = parseError(error);
		seedFromPool();
	} finally {
		priceHistory.loading = false;
	}
}

export function startPriceListener() {
	if (!isConfigured() || priceHistory.listening) return;

	const provider = readProvider();
	listenerContract = new Contract(AMM_ADDRESS, AMM_ABI, provider);
	priceHistory.listening = true;

	void listenerContract.on('PriceUpdated', (...args: unknown[]) => {
		const event = args[args.length - 1] as EventLog;
		const timestamp = args[0] as bigint;
		const reserveA = args[1] as bigint;
		const reserveB = args[2] as bigint;
		const priceAinB = args[3] as bigint;
		const point = toPoint(timestamp, reserveA, reserveB, priceAinB, event?.transactionHash);
		const added = upsertPoint(point);
		if (!added) return;

		const previous = lastNotifiedPrice;
		lastNotifiedPrice = point.price;
		if (previous == null || previous === point.price) return;

		const up = point.price > previous;
		const deltaPct = previous === 0 ? 0 : ((point.price - previous) / previous) * 100;
		const symbolA = pool.symbolA || 'A';
		const symbolB = pool.symbolB || 'B';
		pushToast(
			'price',
			up ? 'Price up' : 'Price down',
			`1 ${symbolA} = ${formatChartPrice(point.price)} ${symbolB} (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%)`,
			point.txHash ? `${SEPOLIA.explorer}/tx/${point.txHash}` : undefined
		);
	});
}

export function stopPriceListener() {
	if (listenerContract) {
		void listenerContract.removeAllListeners('PriceUpdated');
		listenerContract = null;
	}
	priceHistory.listening = false;
}

export function formatChartPrice(value: number) {
	if (!Number.isFinite(value)) return '—';
	if (value === 0) return '0';
	if (value >= 1000) return value.toFixed(2);
	if (value >= 1) return value.toFixed(4);
	if (value >= 0.0001) return value.toFixed(6);
	return value.toExponential(2);
}
