import { Contract, JsonRpcProvider, isAddress } from 'ethers';
import { ERC721_ABI } from './abi';
import { SEPOLIA } from './chain';

const GATEWAYS = [
	'https://ipfs.io/ipfs/',
	'https://dweb.link/ipfs/',
	'https://gateway.pinata.cloud/ipfs/'
];

export type NftMedia = {
	image: string | null;
	name: string | null;
};

const cache = new Map<string, Promise<NftMedia>>();

export function ipfsToHttp(uri: string, gateway = GATEWAYS[0]) {
	const value = uri.trim();
	if (!value) return '';
	if (
		value.startsWith('data:') ||
		value.startsWith('blob:') ||
		value.startsWith('http://') ||
		value.startsWith('https://')
	) {
		return value;
	}

	let path = value;
	if (path.startsWith('ipfs://')) path = path.slice(7);
	if (path.startsWith('ipfs/')) path = path.slice(5);
	if (path.startsWith('/ipfs/')) path = path.slice(6);
	return `${gateway}${path}`;
}

export function ipfsCandidates(uri: string) {
	const value = uri.trim();
	if (!value) return [];
	if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
		return [value];
	}
	return GATEWAYS.map((gateway) => ipfsToHttp(value, gateway));
}

function parseDataJson(uri: string): Record<string, unknown> | null {
	const comma = uri.indexOf(',');
	if (comma < 0) return null;
	const meta = uri.slice(0, comma);
	const payload = uri.slice(comma + 1);
	try {
		const json = meta.includes(';base64') ? atob(payload) : decodeURIComponent(payload);
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function mediaFromMetadata(meta: Record<string, unknown>): NftMedia {
	const rawImage =
		typeof meta.image === 'string'
			? meta.image
			: typeof meta.image_url === 'string'
				? meta.image_url
				: null;
	const name = typeof meta.name === 'string' ? meta.name : null;
	return { image: rawImage, name };
}

async function readTokenUri(nftContract: string, tokenId: string) {
	const nft = new Contract(nftContract, ERC721_ABI, new JsonRpcProvider(SEPOLIA.rpcUrl));
	return (await nft.tokenURI(tokenId)) as string;
}

async function fetchMetadata(uri: string): Promise<NftMedia> {
	if (uri.startsWith('data:application/json')) {
		const meta = parseDataJson(uri);
		return meta ? mediaFromMetadata(meta) : { image: null, name: null };
	}
	if (uri.startsWith('data:image/')) {
		return { image: uri, name: null };
	}

	for (const url of ipfsCandidates(uri)) {
		try {
			const response = await fetch(url);
			if (!response.ok) continue;
			const type = response.headers.get('content-type') ?? '';
			if (type.startsWith('image/')) return { image: url, name: null };
			const meta = (await response.json()) as Record<string, unknown>;
			const media = mediaFromMetadata(meta);
			if (media.image) return media;
		} catch {
			// try the next gateway
		}
	}

	return { image: uri, name: null };
}

export function loadNftMedia(nftContract: string, tokenId: string): Promise<NftMedia> {
	const key = `${nftContract.toLowerCase()}:${tokenId}`;
	const cached = cache.get(key);
	if (cached) return cached;

	const request = (async (): Promise<NftMedia> => {
		if (!isAddress(nftContract) || !/^\d+$/.test(tokenId)) {
			return { image: null, name: null };
		}
		const tokenUri = await readTokenUri(nftContract, tokenId);
		return fetchMetadata(tokenUri);
	})();

	cache.set(key, request);
	void request.catch(() => {
		cache.delete(key);
		return { image: null, name: null };
	});
	return request.then((media) => {
		if (!media.image) cache.delete(key);
		return media;
	});
}
