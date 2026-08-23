<script lang="ts">
	import { isAddress } from 'ethers';
	import NftMedia from '$lib/NftMedia.svelte';
	import {
		AMM_ADDRESS,
		addLiquidity,
		buyNFT,
		cancelListing,
		connect,
		disconnect,
		explorerTx,
		formatAmount,
		isConfigured,
		isConnected,
		isSepolia,
		LP_DECIMALS,
		listNFT,
		pool,
		quoteOut,
		removeLiquidity,
		sameAddress,
		shortenAddress,
		lpSharePercent,
		priceImpact,
		spotPriceAPerB,
		spotPriceBPerA,
		suggestedCounterAmount,
		tryParseAmount,
		swap,
		switchToSepolia,
		tokenMeta,
		wallet,
		withdrawPreview
	} from '$lib';

	type Tab = 'swap' | 'liquidity' | 'pool' | 'nft';

	let tab = $state<Tab>('swap');
	let tokenInIsA = $state(true);
	let amountIn = $state('');
	let amountOutPreview = $state('');
	let amountOutRaw = $state(0n);

	let liqMode = $state<'add' | 'remove'>('add');
	let amountA = $state('');
	let amountB = $state('');
	let lpAmount = $state('');

	let nftContract = $state('');
	let tokenId = $state('');
	let paymentIsA = $state(true);
	let nftPrice = $state('');

	const ready = $derived(isConnected() && isSepolia() && isConfigured() && !wallet.busy);
	const tokenIn = $derived(tokenMeta(pool, tokenInIsA));
	const tokenOut = $derived(tokenMeta(pool, !tokenInIsA));
	const suggestedB = $derived(suggestedCounterAmount(amountA, pool));
	const removePreview = $derived(withdrawPreview(lpAmount, pool));
	const activeListings = $derived(pool.listings.filter((listing) => listing.active));
	const priceAinB = $derived(spotPriceBPerA(pool));
	const priceBinA = $derived(spotPriceAPerB(pool));
	const yourShare = $derived(lpSharePercent(pool));
	const impact = $derived.by(() => {
		const parsedIn = tryParseAmount(amountIn, tokenIn.decimals);
		if (!parsedIn) return null;
		return priceImpact(
			parsedIn,
			amountOutRaw,
			tokenInIsA ? pool.reserveA : pool.reserveB,
			tokenInIsA ? pool.reserveB : pool.reserveA
		);
	});

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'swap', label: 'Swap' },
		{ id: 'liquidity', label: 'Liquidity' },
		{ id: 'pool', label: 'Pool' },
		{ id: 'nft', label: 'NFT' }
	];

	$effect(() => {
		const value = amountIn;
		const isA = tokenInIsA;
		if (!value) {
			amountOutPreview = '';
			amountOutRaw = 0n;
			return;
		}
		void quoteOut(isA, value).then((out) => {
			if (amountIn === value && tokenInIsA === isA) {
				amountOutRaw = out;
				amountOutPreview = out > 0n ? formatAmount(out, tokenMeta(pool, !isA).decimals) : '0';
			}
		});
	});

	function flipTokens() {
		tokenInIsA = !tokenInIsA;
		amountIn = '';
		amountOutPreview = '';
		amountOutRaw = 0n;
	}

	function onSwap(event: SubmitEvent) {
		event.preventDefault();
		void swap(tokenInIsA, amountIn);
	}

	function onAdd(event: SubmitEvent) {
		event.preventDefault();
		void addLiquidity(amountA, amountB);
	}

	function onRemove(event: SubmitEvent) {
		event.preventDefault();
		void removeLiquidity(lpAmount);
	}

	function onList(event: SubmitEvent) {
		event.preventDefault();
		void listNFT(nftContract, tokenId, paymentIsA, nftPrice);
	}

	function tabClass(current: Tab) {
		return tab === current
			? 'bg-safe-green text-safe-bg shadow-[0_0_20px_rgba(18,255,128,0.18)]'
			: 'text-safe-mute hover:bg-safe-hover hover:text-safe-text';
	}

	function subClass(active: boolean) {
		return active
			? 'bg-safe-green text-safe-bg'
			: 'bg-safe-surface text-safe-mute hover:text-safe-text';
	}
</script>

<div class="bg-safe-bg text-safe-text min-h-screen font-sans">
	<header class="border-safe-line border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">{wallet.name}</h1>
				<p class="text-safe-mute mt-0.5 text-sm">Sepolia AMM · Token swap & NFT market</p>
			</div>

			{#if isConnected() && wallet.account}
				<button type="button" class="btn-ghost font-mono" title={wallet.account} onclick={() => disconnect()}>
					{shortenAddress(wallet.account)}
				</button>
			{:else}
				<button
					type="button"
					class="btn-primary w-auto px-5"
					disabled={wallet.connecting}
					onclick={() => connect()}
				>
					{wallet.connecting ? 'Connecting…' : 'Connect MetaMask'}
				</button>
			{/if}
		</div>
	</header>

	<main class="mx-auto max-w-5xl space-y-5 px-6 py-8">
		{#if !isConfigured()}
			<div class="panel px-8 py-10">
				<p class="text-lg font-semibold">AMM address missing</p>
				<p class="text-safe-mute mt-2 text-sm leading-relaxed">
					Set <span class="font-mono text-white">PUBLIC_AMM_ADDRESS</span> in
					<span class="font-mono text-white">frontend/.env</span> and restart the server.
				</p>
			</div>
		{:else}
			<section class="panel overflow-hidden">
				<nav class="bg-safe-surface/80 border-safe-line grid grid-cols-4 gap-1 border-b p-2">
					{#each tabs as item}
						<button
							type="button"
							class="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold {tabClass(item.id)}"
							onclick={() => (tab = item.id)}
						>
							{item.label}
						</button>
					{/each}
				</nav>

				<div class="p-6 md:p-8">
					{#if !wallet.hasProvider && tab !== 'pool'}
						<div class="py-10 text-center">
							<p class="text-lg font-semibold">MetaMask required</p>
							<p class="text-safe-mute mx-auto mt-2 max-w-md text-sm leading-relaxed">
								Install
								<a class="text-safe-green" href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a>
								then reload the page.
							</p>
						</div>
					{:else if !isConnected() && tab !== 'pool'}
						<div class="py-10 text-center">
							<p class="text-lg font-semibold">Connect your wallet</p>
							<p class="text-safe-mute mt-2 text-sm">
								Connect to use the {tab === 'nft' ? 'marketplace' : 'pool'}.
							</p>
						</div>
					{:else if !isSepolia() && tab !== 'pool'}
						<div class="py-10 text-center">
							<p class="text-lg font-semibold">Wrong network</p>
							<p class="text-safe-mute mt-2 text-sm">Switch to Sepolia to send transactions.</p>
							<button
								type="button"
								class="btn-primary mx-auto mt-6 max-w-xs"
								disabled={wallet.switching}
								onclick={() => switchToSepolia()}
							>
								{wallet.switching ? 'Switching…' : 'Switch to Sepolia'}
							</button>
						</div>
					{:else if tab === 'swap'}
						<form class="mx-auto max-w-xl space-y-4" onsubmit={onSwap}>
							<div class="stat">
								<label class="text-safe-mute flex items-center justify-between text-sm">
									<span>You pay</span>
									<span class="text-xs">Balance {formatAmount(tokenIn.balance, tokenIn.decimals)} {tokenIn.symbol}</span>
								</label>
								<div class="mt-2 flex items-center gap-3">
									<input class="field-input mt-0 flex-1 border-0 bg-transparent px-0 text-2xl" bind:value={amountIn} placeholder="0.0" inputmode="decimal" />
									<span class="bg-safe-card text-safe-text rounded-full px-3 py-1 text-sm font-semibold">{tokenIn.symbol}</span>
								</div>
							</div>

							<button type="button" class="btn-ghost mx-auto block" onclick={flipTokens}>
								↕ {tokenIn.symbol} → {tokenOut.symbol}
							</button>

							<div class="stat">
								<label class="text-safe-mute text-sm">You receive</label>
								<div class="mt-2 flex items-center gap-3">
									<input class="field-input mt-0 flex-1 border-0 bg-transparent px-0 text-2xl" value={amountOutPreview} placeholder="0.0" readonly />
									<span class="bg-safe-card text-safe-text rounded-full px-3 py-1 text-sm font-semibold">{tokenOut.symbol}</span>
								</div>
							</div>

							<div class="text-sm">
								<div class="flex items-center justify-between">
									<span class="text-safe-mute">Fee</span>
									<span class="font-mono">{pool.feePercent}%</span>
								</div>
								<div class="mt-1.5 flex items-center justify-between">
									<span class="text-safe-mute">Price impact</span>
									{#if impact}
										<span
											class="font-mono {impact.level === 'high'
												? 'text-red-300'
												: impact.level === 'medium'
													? 'text-amber-300'
													: 'text-safe-green'}"
										>
											{impact.percent}%
										</span>
									{:else}
										<span class="text-safe-mute font-mono">—</span>
									{/if}
								</div>
								{#if impact?.level === 'high'}
									<p class="mt-2 text-xs text-red-300">High impact — this trade moves the pool price a lot.</p>
								{/if}
							</div>

							<button type="submit" class="btn-primary" disabled={!ready || !amountIn}>
								{wallet.busy ? 'Transaction…' : `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`}
							</button>
						</form>
					{:else if tab === 'liquidity'}
						<div class="mb-6 flex gap-2">
							<button type="button" class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold {subClass(liqMode === 'add')}" onclick={() => (liqMode = 'add')}>Add</button>
							<button type="button" class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold {subClass(liqMode === 'remove')}" onclick={() => (liqMode = 'remove')}>Remove</button>
						</div>

						{#if liqMode === 'add'}
							<form class="space-y-5" onsubmit={onAdd}>
								<div class="grid gap-4 md:grid-cols-2">
									<div class="stat">
										<label class="text-safe-mute flex items-center justify-between text-sm">
											<span>{pool.symbolA}</span>
											<span class="text-xs">Balance {formatAmount(pool.userA, pool.decimalsA)}</span>
										</label>
										<input class="field-input border-0 bg-transparent px-0 text-2xl" bind:value={amountA} placeholder="0.0" inputmode="decimal" />
									</div>
									<div class="stat">
										<label class="text-safe-mute flex items-center justify-between text-sm">
											<span>{pool.symbolB}</span>
											<span class="text-xs">Balance {formatAmount(pool.userB, pool.decimalsB)}</span>
										</label>
										<input class="field-input border-0 bg-transparent px-0 text-2xl" bind:value={amountB} placeholder="0.0" inputmode="decimal" />
									</div>
								</div>
								<p class="text-safe-mute text-sm leading-relaxed">
									{#if suggestedB}
										To match the pool: {amountA} {pool.symbolA} ≈ {suggestedB} {pool.symbolB}. Any surplus stays in the pool.
									{:else}
										First deposit: you set the initial price (A/B ratio).
									{/if}
								</p>
								<button type="submit" class="btn-primary" disabled={!ready || !amountA || !amountB}>
									{wallet.busy ? 'Transaction…' : 'Add liquidity'}
								</button>
							</form>
						{:else}
							<form class="mx-auto max-w-xl space-y-5" onsubmit={onRemove}>
								<div class="stat">
									<label class="text-safe-mute flex items-center justify-between text-sm">
										<span>LP tokens</span>
										<span class="text-xs">Balance {formatAmount(pool.userLP, LP_DECIMALS)}</span>
									</label>
									<input class="field-input border-0 bg-transparent px-0 text-2xl" bind:value={lpAmount} placeholder="0.0" inputmode="decimal" />
								</div>
								{#if removePreview}
									<p class="text-safe-mute text-sm">
										You will receive ≈ {formatAmount(removePreview.a, pool.decimalsA)} {pool.symbolA}
										+ {formatAmount(removePreview.b, pool.decimalsB)} {pool.symbolB}
									</p>
								{/if}
								<button type="submit" class="btn-primary" disabled={!ready || !lpAmount}>
									{wallet.busy ? 'Transaction…' : 'Remove liquidity'}
								</button>
							</form>
						{/if}
					{:else if tab === 'pool'}
						<div class="mx-auto max-w-2xl">
							<div class="flex items-end justify-between gap-6">
								<div>
									<p class="text-safe-mute text-xs tracking-[0.2em] uppercase">Pair</p>
									<p class="mt-2 text-2xl font-semibold tracking-tight">{pool.symbolA}<span class="text-safe-mute"> / </span>{pool.symbolB}</p>
								</div>
								<div class="text-right">
									<p class="text-safe-mute text-xs tracking-[0.2em] uppercase">Last</p>
									<p class="text-safe-green mt-2 font-mono text-3xl font-semibold">{priceAinB}</p>
									<p class="text-safe-mute mt-1 text-sm">{pool.symbolB} per {pool.symbolA}</p>
								</div>
							</div>

							<div class="border-safe-line mt-8 grid grid-cols-2 border-y py-5">
								<div class="pr-6">
									<p class="text-safe-mute text-xs uppercase tracking-wider">{pool.symbolA}</p>
									<p class="mt-2 font-mono text-xl">{formatAmount(pool.reserveA, pool.decimalsA)}</p>
								</div>
								<div class="border-safe-line border-l pl-6 text-right">
									<p class="text-safe-mute text-xs uppercase tracking-wider">{pool.symbolB}</p>
									<p class="mt-2 font-mono text-xl">{formatAmount(pool.reserveB, pool.decimalsB)}</p>
								</div>
							</div>

							<dl class="divide-safe-line divide-y text-sm">
								<div class="flex items-center justify-between py-3.5">
									<dt class="text-safe-mute">Inverse</dt>
									<dd class="font-mono">{priceBinA} {pool.symbolA}</dd>
								</div>
								<div class="flex items-center justify-between py-3.5">
									<dt class="text-safe-mute">Fee</dt>
									<dd class="font-mono">{pool.feePercent}%</dd>
								</div>
								<div class="flex items-center justify-between py-3.5">
									<dt class="text-safe-mute">LP supply</dt>
									<dd class="font-mono">{formatAmount(pool.totalLP, LP_DECIMALS)}</dd>
								</div>
								{#if isConnected()}
									<div class="flex items-center justify-between py-3.5">
										<dt class="text-safe-mute">Your share</dt>
										<dd class="font-mono">{yourShare}%</dd>
									</div>
								{/if}
								<div class="flex items-center justify-between py-3.5">
									<dt class="text-safe-mute">Contract</dt>
									<dd class="font-mono" title={AMM_ADDRESS}>{shortenAddress(AMM_ADDRESS)}</dd>
								</div>
							</dl>

							{#if isConnected()}
								<div class="border-safe-line mt-2 flex flex-wrap justify-between gap-4 border-t pt-5 font-mono text-sm">
									<span>{formatAmount(pool.userA, pool.decimalsA)} <span class="text-safe-mute">{pool.symbolA}</span></span>
									<span>{formatAmount(pool.userB, pool.decimalsB)} <span class="text-safe-mute">{pool.symbolB}</span></span>
									<span>{formatAmount(pool.userLP, LP_DECIMALS)} <span class="text-safe-mute">LP</span></span>
								</div>
							{/if}
						</div>
					{:else}
						<div class="grid gap-8 lg:grid-cols-2">
							<form class="space-y-4" onsubmit={onList}>
								<p class="text-lg font-semibold">List an NFT</p>
								{#if isAddress(nftContract) && /^\d+$/.test(tokenId)}
									<NftMedia {nftContract} {tokenId} alt="NFT preview" />
								{/if}
								<label class="text-safe-mute block text-sm">
									NFT contract
									<input class="field-input" bind:value={nftContract} placeholder="0x…" spellcheck="false" />
								</label>
								<div class="grid gap-4 sm:grid-cols-2">
									<label class="text-safe-mute block text-sm">
										Token ID
										<input class="field-input" bind:value={tokenId} placeholder="0" inputmode="numeric" />
									</label>
									<label class="text-safe-mute block text-sm">
										Price
										<input class="field-input" bind:value={nftPrice} placeholder="0.0" inputmode="decimal" />
									</label>
								</div>
								<div class="flex gap-2">
									<button type="button" class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold {subClass(paymentIsA)}" onclick={() => (paymentIsA = true)}>{pool.symbolA}</button>
									<button type="button" class="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold {subClass(!paymentIsA)}" onclick={() => (paymentIsA = false)}>{pool.symbolB}</button>
								</div>
								<button type="submit" class="btn-primary" disabled={!ready || !nftContract || !tokenId || !nftPrice}>
									{wallet.busy ? 'Transaction…' : 'List NFT'}
								</button>
							</form>

							<div>
								<p class="text-lg font-semibold">Active listings</p>
								{#if activeListings.length === 0}
									<p class="text-safe-mute mt-4 text-sm">No listings yet.</p>
								{:else}
									<div class="mt-4 space-y-3">
										{#each activeListings as listing (listing.id)}
											{@const payA = sameAddress(listing.paymentToken, pool.tokenA)}
											{@const mine = Boolean(wallet.account && sameAddress(listing.seller, wallet.account))}
											<div class="stat">
												<NftMedia nftContract={listing.nftContract} tokenId={listing.tokenId} alt="Listed NFT" />
												<p class="mt-3 font-mono text-sm">
													#{listing.id} ·
													<span title={listing.nftContract}>{shortenAddress(listing.nftContract)}</span>
													#{listing.tokenId}
												</p>
												<p class="text-safe-mute mt-1 text-sm">
													Seller <span title={listing.seller}>{shortenAddress(listing.seller)}</span>
												</p>
												<p class="mt-3 text-lg font-semibold">
													{formatAmount(listing.price, payA ? pool.decimalsA : pool.decimalsB)}
													{payA ? pool.symbolA : pool.symbolB}
												</p>
												{#if mine}
													<button type="button" class="btn-ghost mt-3 w-full py-2" disabled={!ready} onclick={() => cancelListing(listing.id)}>
														Cancel
													</button>
												{:else}
													<button type="button" class="btn-primary mt-3" disabled={!ready} onclick={() => buyNFT(listing)}>
														Buy
													</button>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if wallet.error}
			<p class="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
				{wallet.error}
			</p>
		{/if}

		{#if wallet.lastTx}
			<p class="text-safe-mute text-sm">
				{wallet.lastMessage ?? 'Transaction confirmed.'}
				<a class="text-safe-green" href={explorerTx(wallet.lastTx)} target="_blank" rel="noreferrer">
					Etherscan
				</a>
			</p>
		{/if}
	</main>
</div>
