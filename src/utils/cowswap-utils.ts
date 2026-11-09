import type { Address } from "viem";
import {
  getQuoteAmountsAndCosts,
  OrderBookApi,
  OrderQuoteSideKindSell,
  type OrderQuoteResponse,
  type QuoteAmountsAndCosts,
  type SupportedChainId,
} from "@cowprotocol/cow-sdk";
import { getTokenInfo } from "../constants/supported-reward-tokens.ts";

interface CowSwapQuoteParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  userAddress: Address;
  chainId: number;
  orderBookApi?: Pick<OrderBookApi, "getQuote">;
}

interface CowSwapQuoteResult {
  estimatedAmountOut: bigint;
  feeAmount?: bigint;
  amountsAndCosts: QuoteAmountsAndCosts;
}

const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * Fetches a quote from the CowSwap API for a potential UUSD settlement swap.
 * Does not require signing or submit an order.
 */
export async function getCowSwapQuote(params: CowSwapQuoteParams): Promise<CowSwapQuoteResult> {
  if (!params.chainId) {
    throw new Error("Chain ID is required to get CowSwap quote.");
  }
  if (params.amountIn <= 0n) {
    throw new Error("Amount in must be greater than zero.");
  }

  const tokenInInfo = getTokenInfo(params.chainId, params.tokenIn);
  const tokenOutInfo = getTokenInfo(params.chainId, params.tokenOut);

  if (!tokenInInfo || !tokenOutInfo) {
    throw new Error(`Cannot find token info for ${params.tokenIn} or ${params.tokenOut} on chain ${params.chainId}`);
  }

  if (tokenInInfo.symbol.toUpperCase() !== "UUSD") {
    throw new Error(`CowSwap settlements are only supported for UUSD (received ${tokenInInfo.symbol}).`);
  }

  if (tokenInInfo.address.toLowerCase() === tokenOutInfo.address.toLowerCase()) {
    return {
      estimatedAmountOut: params.amountIn,
      feeAmount: 0n,
      amountsAndCosts: {} as QuoteAmountsAndCosts,
    };
  }

  const api = params.orderBookApi ?? new OrderBookApi({ chainId: params.chainId as SupportedChainId });
  const quoteResponse: OrderQuoteResponse = await api.getQuote({
    sellToken: tokenInInfo.address,
    buyToken: tokenOutInfo.address,
    from: params.userAddress,
    receiver: params.userAddress,
    sellAmountBeforeFee: params.amountIn.toString(),
    kind: OrderQuoteSideKindSell.SELL,
  });

  const amountsAndCosts = getQuoteAmountsAndCosts({
    orderParams: quoteResponse.quote,
    sellDecimals: tokenInInfo.decimals,
    buyDecimals: tokenOutInfo.decimals,
    slippagePercentBps: DEFAULT_SLIPPAGE_BPS,
    partnerFeeBps: undefined,
  });

  return {
    estimatedAmountOut: BigInt(quoteResponse.quote.buyAmount),
    feeAmount: BigInt(quoteResponse.quote.feeAmount),
    amountsAndCosts,
  };
}
