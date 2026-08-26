export const AMM_ABI = [
	'function tokenA() view returns (address)',
	'function tokenB() view returns (address)',
	'function feePercent() view returns (uint256)',
	'function getReserves() view returns (uint256, uint256)',
	'function getAmountOut(address tokenIn, uint256 amountIn) view returns (uint256)',
	'function totalSupply() view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function name() view returns (string)',
	'function addLiquidity(uint256 amountA, uint256 amountB) returns (uint256)',
	'function removeLiquidity(uint256 lpAmount) returns (uint256, uint256)',
	'function swap(address tokenIn, uint256 amountIn) returns (uint256)',
	'function listingCount() view returns (uint256)',
	'function listings(uint256) view returns (address seller, address nftContract, uint256 tokenId, address paymentToken, uint256 price, bool active)',
	'function listNFT(address nftContract, uint256 tokenId, address paymentToken, uint256 price) returns (uint256)',
	'function buyNFT(uint256 listingId)',
	'function cancelListing(uint256 listingId)',
	'event PriceUpdated(uint256 indexed timestamp, uint256 reserveA, uint256 reserveB, uint256 priceAinB)',
	'event Swapped(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut)',
	'event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpMinted)'
];

export const ERC20_ABI = [
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function balanceOf(address account) view returns (uint256)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)'
];

export const ERC721_ABI = [
	'function approve(address to, uint256 tokenId)',
	'function getApproved(uint256 tokenId) view returns (address)',
	'function isApprovedForAll(address owner, address operator) view returns (bool)',
	'function ownerOf(uint256 tokenId) view returns (address)',
	'function tokenURI(uint256 tokenId) view returns (string)'
];
