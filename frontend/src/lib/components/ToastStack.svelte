<script lang="ts">
	import { dismissToast, toasts } from '$lib/toast.svelte';
	import type { ToastKind } from '$lib/types';

	function kindClass(kind: ToastKind) {
		switch (kind) {
			case 'success':
				return 'border-safe-green/40 bg-safe-green/10 text-safe-text';
			case 'error':
				return 'border-red-400/40 bg-red-500/10 text-red-100';
			case 'price':
				return 'border-amber-300/35 bg-amber-400/10 text-amber-50';
			default:
				return 'border-safe-line bg-safe-card text-safe-text';
		}
	}

	function kindLabel(kind: ToastKind) {
		switch (kind) {
			case 'success':
				return 'Success';
			case 'error':
				return 'Error';
			case 'price':
				return 'Price';
			default:
				return 'Info';
		}
	}
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col gap-2">
	{#each toasts as toast (toast.id)}
		<div class="pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm {kindClass(toast.kind)}">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-70">
						{kindLabel(toast.kind)}
					</p>
					<p class="mt-1 text-sm font-semibold">{toast.title}</p>
					{#if toast.message}
						<p class="mt-1 text-xs leading-relaxed opacity-90">{toast.message}</p>
					{/if}
					{#if toast.href}
						<a
							class="mt-2 inline-block text-xs font-semibold text-safe-green underline-offset-2 hover:underline"
							href={toast.href}
							target="_blank"
							rel="noreferrer"
						>
							View on Etherscan
						</a>
					{/if}
				</div>
				<button
					type="button"
					class="text-safe-mute hover:text-safe-text cursor-pointer rounded-full px-1 text-lg leading-none"
					aria-label="Dismiss"
					onclick={() => dismissToast(toast.id)}
				>
					×
				</button>
			</div>
		</div>
	{/each}
</div>
