<script lang="ts">
	import { formatChartPrice, priceHistory } from '$lib/price-history.svelte';
	import type { PricePoint } from '$lib/types';

	let {
		symbolA = 'A',
		symbolB = 'B',
		inverted = false,
		ontoggle
	}: {
		symbolA?: string;
		symbolB?: string;
		inverted?: boolean;
		ontoggle?: () => void;
	} = $props();

	let width = $state(640);
	let height = $state(280);
	let hoverIndex = $state<number | null>(null);
	let chartEl: HTMLDivElement | undefined = $state();

	const pad = { top: 24, right: 64, bottom: 36, left: 12 };

	const baseSymbol = $derived(inverted ? symbolB : symbolA);
	const quoteSymbol = $derived(inverted ? symbolA : symbolB);
	const points = $derived(
		inverted
			? priceHistory.points.map((p) => ({
					...p,
					price: p.price > 0 ? 1 / p.price : 0
				}))
			: priceHistory.points
	);
	const last = $derived(points[points.length - 1] ?? null);
	const first = $derived(points[0] ?? null);
	const change = $derived.by(() => {
		if (!first || !last || first.price === 0) return null;
		const pct = ((last.price - first.price) / first.price) * 100;
		return { pct, up: pct >= 0 };
	});

	const plot = $derived.by(() => {
		if (points.length === 0) return null;
		const prices = points.map((p) => p.price);
		let min = Math.min(...prices);
		let max = Math.max(...prices);
		if (min === max) {
			min *= 0.98;
			max *= 1.02;
			if (min === 0 && max === 0) {
				min = -1;
				max = 1;
			}
		}
		const span = max - min || 1;
		const innerW = Math.max(1, width - pad.left - pad.right);
		const innerH = Math.max(1, height - pad.top - pad.bottom);
		const xs = points.map((_, i) =>
			points.length === 1 ? pad.left + innerW / 2 : pad.left + (i / (points.length - 1)) * innerW
		);
		const ys = points.map((p) => pad.top + ((max - p.price) / span) * innerH);
		const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(' ');
		const area = `${line} L${xs[xs.length - 1].toFixed(2)},${(pad.top + innerH).toFixed(2)} L${xs[0].toFixed(2)},${(pad.top + innerH).toFixed(2)} Z`;
		const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
			const y = pad.top + t * innerH;
			const price = max - t * span;
			return { y, price };
		});
		return { xs, ys, line, area, grid, min, max, innerW, innerH };
	});

	const active = $derived(
		hoverIndex != null && points[hoverIndex] ? points[hoverIndex] : last
	);

	$effect(() => {
		if (!chartEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			width = Math.max(280, Math.floor(entry.contentRect.width));
			height = Math.max(220, Math.floor(entry.contentRect.height));
		});
		ro.observe(chartEl);
		return () => ro.disconnect();
	});

	function onMove(event: MouseEvent) {
		if (!plot || points.length === 0) return;
		const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = event.clientX - rect.left;
		let best = 0;
		let bestDist = Infinity;
		for (let i = 0; i < plot.xs.length; i++) {
			const d = Math.abs(plot.xs[i] - x);
			if (d < bestDist) {
				bestDist = d;
				best = i;
			}
		}
		hoverIndex = best;
	}

	function onLeave() {
		hoverIndex = null;
	}

	function formatTime(ts: number) {
		return new Date(ts * 1000).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function labelTime(point: PricePoint | null) {
		if (!point) return '';
		return formatTime(point.timestamp);
	}
</script>

<div class="flex h-full min-h-[280px] flex-col" bind:this={chartEl}>
	<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
		<div>
			<div class="flex items-center gap-2">
				<p class="text-safe-mute text-xs tracking-[0.2em] uppercase">Spot</p>
				<button
					type="button"
					class="btn-ghost px-2.5 py-1 text-xs"
					onclick={() => ontoggle?.()}
					title="Flip pair"
				>
					{baseSymbol} / {quoteSymbol}
					<span class="ml-1" aria-hidden="true">⇄</span>
				</button>
			</div>
			<p class="mt-1 font-mono text-2xl font-semibold tracking-tight">
				{active ? formatChartPrice(active.price) : '—'}
				<span class="text-safe-mute text-sm font-medium">{quoteSymbol}</span>
			</p>
			{#if active}
				<p class="text-safe-mute mt-1 text-xs">1 {baseSymbol} · {labelTime(active)}</p>
			{/if}
		</div>
		<div class="text-right">
			{#if change}
				<p class="font-mono text-sm font-semibold {change.up ? 'text-safe-green' : 'text-red-300'}">
					{change.up ? '+' : ''}{change.pct.toFixed(2)}%
				</p>
				<p class="text-safe-mute mt-1 text-xs">vs first point in range</p>
			{:else if priceHistory.loading}
				<p class="text-safe-mute text-xs">Loading history…</p>
			{:else}
				<p class="text-safe-mute text-xs">Waiting for PriceUpdated events</p>
			{/if}
		</div>
	</div>

	{#if points.length === 0}
		<div class="border-safe-line bg-safe-surface/50 flex flex-1 items-center justify-center rounded-2xl border border-dashed">
			<p class="text-safe-mute max-w-sm px-6 text-center text-sm leading-relaxed">
				{#if priceHistory.loading}
					Fetching on-chain price logs…
				{:else if priceHistory.error}
					Could not load logs. Swap or add liquidity to emit the first <span class="font-mono">PriceUpdated</span>.
				{:else}
					No price history yet. The chart fills from on-chain <span class="font-mono">PriceUpdated</span> events.
				{/if}
			</p>
		</div>
	{:else if plot}
		{@const up = change?.up !== false}
		<svg
			class="h-full w-full touch-none select-none"
			viewBox={`0 0 ${width} ${height}`}
			role="img"
			aria-label="Price chart"
			onmousemove={onMove}
			onmouseleave={onLeave}
		>
			{#each plot.grid as row}
				<line
					x1={pad.left}
					x2={width - pad.right}
					y1={row.y}
					y2={row.y}
					stroke="currentColor"
					class="text-safe-line"
					stroke-width="1"
					opacity="0.55"
				/>
				<text
					x={width - pad.right + 8}
					y={row.y + 4}
					class="fill-safe-mute font-mono"
					font-size="10"
				>
					{formatChartPrice(row.price)}
				</text>
			{/each}

			<path d={plot.area} fill={up ? 'rgba(18,255,128,0.12)' : 'rgba(252,165,165,0.12)'} />
			<path
				d={plot.line}
				fill="none"
				stroke={up ? '#12ff80' : '#fca5a5'}
				stroke-width="2.25"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>

			{#if hoverIndex != null && points[hoverIndex]}
				{@const i = hoverIndex}
				<line
					x1={plot.xs[i]}
					x2={plot.xs[i]}
					y1={pad.top}
					y2={height - pad.bottom}
					stroke="#b2b5b2"
					stroke-dasharray="4 4"
					stroke-width="1"
				/>
				<circle cx={plot.xs[i]} cy={plot.ys[i]} r="4.5" fill="#121312" stroke={up ? '#12ff80' : '#fca5a5'} stroke-width="2" />
			{:else}
				<circle
					cx={plot.xs[plot.xs.length - 1]}
					cy={plot.ys[plot.ys.length - 1]}
					r="3.5"
					fill={up ? '#12ff80' : '#fca5a5'}
				/>
			{/if}

			{#if first && last && points.length > 1}
				<text x={pad.left} y={height - 10} class="fill-safe-mute font-mono" font-size="10">
					{labelTime(first)}
				</text>
				<text
					x={width - pad.right}
					y={height - 10}
					text-anchor="end"
					class="fill-safe-mute font-mono"
					font-size="10"
				>
					{labelTime(last)}
				</text>
			{/if}
		</svg>
	{/if}
</div>
