<script lang="ts">
	import { untrack } from 'svelte';
	import { ipfsCandidates, loadNftMedia } from './nft-media';

	let { nftContract, tokenId, alt = 'NFT' }: { nftContract: string; tokenId: string; alt?: string } =
		$props();

	let image = $state<string | null>(null);
	let fallbacks = $state<string[]>([]);
	let name = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		const contract = nftContract;
		const id = tokenId;

		untrack(() => {
			image = null;
			name = null;
			fallbacks = [];
			loading = Boolean(contract && id);
		});

		if (!contract || !id) return;

		let cancelled = false;
		void loadNftMedia(contract, id)
			.then((media) => {
				if (cancelled) return;
				const urls = media.image ? ipfsCandidates(media.image) : [];
				image = urls[0] ?? media.image;
				fallbacks = urls.slice(1);
				name = media.name;
			})
			.catch(() => {
				if (!cancelled) image = null;
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	function nextGateway() {
		image = fallbacks[0] ?? null;
		fallbacks = fallbacks.slice(1);
	}
</script>

<div class="bg-safe-surface relative aspect-square overflow-hidden rounded-xl">
	{#if image}
		<img src={image} alt={name ?? alt} class="h-full w-full object-cover" onerror={nextGateway} />
	{:else if loading}
		<div class="text-safe-mute flex h-full items-center justify-center text-sm">Loading image…</div>
	{:else}
		<div class="text-safe-mute flex h-full items-center justify-center text-sm">No image</div>
	{/if}
</div>
{#if name}
	<p class="mt-2 truncate text-sm font-medium">{name}</p>
{/if}
