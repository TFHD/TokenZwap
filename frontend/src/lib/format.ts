import { formatUnits, parseUnits } from 'ethers';

export function shortenAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function sameAddress(a: string, b: string) {
	return a.toLowerCase() === b.toLowerCase();
}

export function formatAmount(value: bigint, decimals: number, digits = 6) {
	const raw = formatUnits(value, decimals);
	const [whole, frac = ''] = raw.split('.');
	if (!frac) return whole;
	const trimmed = frac.slice(0, digits).replace(/0+$/, '');
	return trimmed ? `${whole}.${trimmed}` : whole;
}

export function tryParseAmount(value: string, decimals: number): bigint | null {
	if (!value) return null;
	try {
		const parsed = parseUnits(value, decimals);
		return parsed > 0n ? parsed : null;
	} catch {
		return null;
	}
}

export function parseAmount(value: string, decimals: number, label = 'amount') {
	const parsed = tryParseAmount(value, decimals);
	if (!parsed) throw new Error(`Invalid ${label}.`);
	return parsed;
}
