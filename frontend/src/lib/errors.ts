type EthersError = {
	code?: number | string;
	shortMessage?: string;
	reason?: string;
	message?: string;
};

const REVERT_MESSAGES: [needle: string, message: string][] = [
	['Insufficient liquidity', 'Not enough liquidity in the pool.'],
	['Insufficient output amount', 'Output amount is too small.'],
	['Not enough LP tokens', 'Not enough LP tokens.'],
	['Listing not active', 'This listing is no longer active.'],
	['Cannot buy your own NFT', 'You cannot buy your own NFT.'],
	['Not the seller', 'Only the seller can cancel.'],
	['Not the owner', 'You do not own this NFT.'],
	['Payment token', 'Payment token must be A or B.'],
	['ERC20InsufficientAllowance', 'Insufficient allowance — try again to approve the contract.'],
	['insufficient allowance', 'Insufficient allowance — try again to approve the contract.']
];

export function parseError(error: unknown): string {
	if (!error || typeof error !== 'object') return 'Something went wrong.';

	const e = error as EthersError;
	if (e.code === 4001 || e.code === 'ACTION_REJECTED') return 'Action rejected in MetaMask.';

	const text = `${e.shortMessage ?? ''} ${e.reason ?? ''} ${e.message ?? ''}`;
	for (const [needle, message] of REVERT_MESSAGES) {
		if (text.includes(needle)) return message;
	}

	if (e.shortMessage) return e.shortMessage;
	if (e.reason) return e.reason;
	if (typeof e.message === 'string' && e.message.length < 180) return e.message;
	return 'Something went wrong.';
}
