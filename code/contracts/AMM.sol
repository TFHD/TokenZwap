// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AMSSabartho
 * @notice Constant-product liquidity pool (Token A / Token B) plus a fixed-price NFT marketplace.
 * @dev This contract is also the LP token: it inherits ERC20 and mints/burns AMMLP shares.
 *
 * Pool pricing uses x * y = k. Spot prices are:
 *   price of 1 A in B = reserveB / reserveA
 *   price of 1 B in A = reserveA / reserveB
 *
 * LP tokens represent a share of the vault: lpAmount / totalSupply() of each reserve.
 * The NFT marketplace is independent escrow: listings are paid in Token A or Token B,
 * not priced by the AMM curve.
 */
contract AMSSabartho is ERC20, IERC721Receiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    /// @notice Token A currently held by the pool (should match tokenA.balanceOf(this) for pool funds).
    uint256 public reserveA;
    /// @notice Token B currently held by the pool.
    uint256 public reserveB;

    /// @notice Swap fee in percent, fixed at deploy time. Must be between 1 and 10.
    uint256 public feePercent;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        address paymentToken; // Must be Token A or Token B
        uint256 price;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public listingCount;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 lpBurned);
    event Swapped(address indexed user, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);
    event NFTListed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, address paymentToken, uint256 price);
    event NFTPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price);
    event NFTListingCancelled(uint256 indexed listingId, address indexed seller);
    event PriceUpdated(uint256 indexed timestamp, uint256 reserveA, uint256 reserveB, uint256 priceAinB);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(
        address _tokenA,
        address _tokenB,
        uint256 _feePercent
    ) ERC20("AMM LP Token", "AMMLP") Ownable(msg.sender) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token");
        require(_tokenA != _tokenB, "Tokens must be different");
        require(_feePercent >= 1 && _feePercent <= 10, "Fee must be between 1 and 10");

        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);

        feePercent = _feePercent;
    }

    // ============================================================
    //                    LIQUIDITY FUNCTIONS
    // ============================================================

    /**
     * @notice Deposit Token A and Token B and receive LP shares.
     * @dev Caller must have approved this contract to spend both tokens.
     *
     * First deposit mints sqrt(amountA * amountB) LP and sets the initial price.
     * Later deposits mint min(lpFromA, lpFromB) so the depositor is never credited
     * more than the weaker side. Unbalanced excess stays in the pool (no refund).
     *
     *   lpFromA = amountA * totalLP / reserveA
     *   lpFromB = amountB * totalLP / reserveB
     *
     * `deadline` is a unix timestamp; the tx reverts with "Deadline expired" after that.
     */
    function addLiquidity(
        uint256 amountA,
        uint256 amountB,
        uint256 deadline
    ) external nonReentrant _ensureDeadline(deadline) returns (uint256 lpMinted) {
        require(amountA > 0 && amountB > 0, "Amounts must be > 0");

        // Pull tokens from the caller into this contract (the pool).
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        uint256 totalLP = totalSupply();

        if (totalLP == 0) {
            // First LP: geometric mean sets initial liquidity (independent of the A/B ratio).
            lpMinted = sqrt(amountA * amountB);
            require(lpMinted > 0, "Insufficient liquidity minted");
        } else {
            // How many LP each side would justify on its own; mint the smaller one
            // so ownership % cannot exceed the weaker deposit.
            uint256 lpFromA = (amountA * totalLP) / reserveA;
            uint256 lpFromB = (amountB * totalLP) / reserveB;
            lpMinted = lpFromA < lpFromB ? lpFromA : lpFromB;
            require(lpMinted > 0, "Insufficient liquidity minted");
        }

        reserveA += amountA;
        reserveB += amountB;

        _mint(msg.sender, lpMinted);

        emit LiquidityAdded(msg.sender, amountA, amountB, lpMinted);
        emit PriceUpdated(block.timestamp, reserveA, reserveB, (reserveB * 1e18) / reserveA);
    }

    /**
     * @notice Burn LP shares and withdraw the matching fraction of both reserves.
     * @dev amountA/B = lpAmount / totalLP * reserve. Price is unchanged; k decreases.
     * Reverts after `deadline` so a stuck burn cannot execute at a later reserve mix.
     */
    function removeLiquidity(
        uint256 lpAmount,
        uint256 deadline
    ) external nonReentrant _ensureDeadline(deadline) returns (uint256 amountA, uint256 amountB) {
        require(lpAmount > 0, "LP amount must be > 0");
        require(balanceOf(msg.sender) >= lpAmount, "Not enough LP tokens");

        uint256 totalLP = totalSupply();

        // Proportional claim: same share of Token A and Token B.
        amountA = (lpAmount * reserveA) / totalLP;
        amountB = (lpAmount * reserveB) / totalLP;

        require(amountA > 0 && amountB > 0, "Insufficient amounts");

        _burn(msg.sender, lpAmount);

        reserveA -= amountA;
        reserveB -= amountB;

        // Send the withdrawn tokens from the pool back to the caller.
        tokenA.safeTransfer(msg.sender, amountA);
        tokenB.safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, lpAmount);
    }

    // ============================================================
    //                        SWAP FUNCTION
    // ============================================================

    /**
     * @notice Swap `amountIn` of Token A for Token B, or the other way around.
     * @dev Constant-product quote (fee applied on the way in):
     *
     *   amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
     *
     * Full `amountIn` is added to the input reserve (fee stays in the pool for LPs).
     * If a later require fails, the whole tx reverts and the pull is undone.
     *
     * `minAmountOut` caps sandwich / slippage. `deadline` drops a stuck tx so it
     * cannot be included much later at a stale quote.
     */
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant _ensureDeadline(deadline) returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        require(
            tokenIn == address(tokenA) || tokenIn == address(tokenB),
            "Invalid token"
        );

        bool isTokenAIn = tokenIn == address(tokenA);
        IERC20 tokenOut = isTokenAIn ? tokenB : tokenA;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 amountInWithFee = getFeeAmount(amountIn);

        if (isTokenAIn) {
            amountOut = (amountInWithFee * reserveB) / (reserveA + amountInWithFee);
            require(amountOut < reserveB, "Insufficient liquidity");

            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            amountOut = (amountInWithFee * reserveA) / (reserveB + amountInWithFee);
            require(amountOut < reserveA, "Insufficient liquidity");

            reserveB += amountIn;
            reserveA -= amountOut;
        }

        require(amountOut > 0, "Insufficient output amount");
        require(amountOut >= minAmountOut, "slippage too high");

        tokenOut.safeTransfer(msg.sender, amountOut);

        emit Swapped(msg.sender, tokenIn, amountIn, address(tokenOut), amountOut);
        emit PriceUpdated(block.timestamp, reserveA, reserveB, (reserveB * 1e18) / reserveA);
    }

    // ============================================================
    //                   VIEW HELPERS (POOL)
    // ============================================================

    /// @notice Current pool reserves (Token A, Token B).
    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    /**
     * @notice Preview how many tokens `swap` would send out for `amountIn`.
     * @dev Same formula as `swap`, but does not move tokens or update reserves.
     */
    function getAmountOut(
        address tokenIn,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be > 0");
        require(
            tokenIn == address(tokenA) || tokenIn == address(tokenB),
            "Invalid token"
        );

        uint256 amountInWithFee = getFeeAmount(amountIn);

        if (tokenIn == address(tokenA)) {
            amountOut = (amountInWithFee * reserveB) / (reserveA + amountInWithFee);
        } else {
            amountOut = (amountInWithFee * reserveA) / (reserveB + amountInWithFee);
        }
    }

    // ============================================================
    //                 NFT FIXED-PRICE MARKETPLACE
    // ============================================================

    /**
     * @notice Escrow an NFT in this contract and create a fixed-price listing.
     * @dev Caller must own the NFT and have approved this contract on the NFT contract.
     * Payment token must be Token A or Token B. Price is set by the seller, not the AMM.
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) external nonReentrant returns (uint256 listingId) {
        require(price > 0, "Price must be > 0");
        require(
            paymentToken == address(tokenA) || paymentToken == address(tokenB),
            "Payment token invalid"
        );
        require(
            IERC721(nftContract).ownerOf(tokenId) == msg.sender,
            "Not the owner of the NFT"
        );

        // Escrow: this contract becomes the NFT owner until buy or cancel.
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        listingId = listingCount++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            paymentToken: paymentToken,
            price: price,
            active: true
        });

        emit NFTListed(listingId, msg.sender, nftContract, tokenId, paymentToken, price);
    }

    /**
     * @notice Buy a listed NFT. Payment goes to the seller; the NFT is sent to the buyer.
     * @dev Buyer must have approved this contract to spend `listing.price` of the payment token.
     */
    function buyNFT(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller != msg.sender, "Cannot buy your own NFT");

        listing.active = false;

        // Pay the seller directly (funds do not enter the AMM pool).
        IERC20(listing.paymentToken).safeTransferFrom(
            msg.sender,
            listing.seller,
            listing.price
        );

        IERC721(listing.nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit NFTPurchased(listingId, msg.sender, listing.seller, listing.price);
    }

    /// @notice Seller-only: close a listing and get the NFT back.
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;

        IERC721(listing.nftContract).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit NFTListingCancelled(listingId, msg.sender);
    }

    // ============================================================
    //                    ERC721 RECEIVER
    // ============================================================

    /**
     * @notice Required by ERC-721 so `safeTransferFrom` can send NFTs to this contract.
     * @dev Must return this function's selector; otherwise listing escrow would revert.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    /// @notice Reject txs included after `deadline` (unix seconds).
    modifier _ensureDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "Deadline expired");
        _;
    }

    /// @notice Integer square root (Babylonian method), used for the first LP mint.
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /// @notice Amount kept for the swap after the fee
    function getFeeAmount(uint256 amount) internal view returns (uint256) {
        return (amount * (100 - feePercent)) / 100;
    }
}
