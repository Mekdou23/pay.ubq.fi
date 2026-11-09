import { describe, expect, it } from "bun:test";
import type { OrderQuoteResponse } from "@cowprotocol/cow-sdk";
import { getCowSwapQuote } from "../src/utils/cowswap-utils.ts";

const GNOSIS_CHAIN_ID = 100;
const GNOSIS_UUSD = "0xC6ed4f520f6A4e4DC27273509239b7F8A68d2068";
const GNOSIS_USDT = "0x4ECaBa5870353805a9F068101A40E0f32ed605C6";
const GNOSIS_USDC = "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83";
const USER_ADDRESS = "0x000000000000000000000000000000000000dEaD";

describe("getCowSwapQuote", () => {
  it("fetches a CowSwap quote for UUSD to USDT on Gnosis and returns estimatedAmountOut", async () => {
    let capturedRequest: unknown = null;
    const mockOrderBookApi = {
      async getQuote(req: unknown): Promise<OrderQuoteResponse> {
        capturedRequest = req;
        return {
          quote: {
            sellToken: GNOSIS_UUSD,
            buyToken: GNOSIS_USDT,
            receiver: USER_ADDRESS,
            sellAmount: "99500000000000000000",
            buyAmount: "99500000",
            validTo: 1900000000,
            appData: "0x0000000000000000000000000000000000000000000000000000000000000000",
            feeAmount: "500000000000000000",
            kind: "sell",
            partiallyFillable: false,
          },
          from: USER_ADDRESS,
          expiration: "2030-01-01T00:00:00Z",
          id: 42,
          verified: true,
        } as unknown as OrderQuoteResponse;
      },
    };

    const result = await getCowSwapQuote({
      tokenIn: GNOSIS_UUSD,
      tokenOut: GNOSIS_USDT,
      amountIn: 100n * 10n ** 18n,
      userAddress: USER_ADDRESS,
      chainId: GNOSIS_CHAIN_ID,
      orderBookApi: mockOrderBookApi,
    });

    expect(capturedRequest).toEqual({
      sellToken: GNOSIS_UUSD,
      buyToken: GNOSIS_USDT,
      from: USER_ADDRESS,
      receiver: USER_ADDRESS,
      sellAmountBeforeFee: (100n * 10n ** 18n).toString(),
      kind: "sell",
    });
    expect(result.estimatedAmountOut).toBe(99500000n);
    expect(result.feeAmount).toBe(500000000000000000n);
    expect(result.amountsAndCosts.afterNetworkCosts.buyAmount).toBe(99500000n);
  });

  it("rejects non-UUSD settlement tokens", async () => {
    await expect(
      getCowSwapQuote({
        tokenIn: GNOSIS_USDC,
        tokenOut: GNOSIS_USDT,
        amountIn: 100n * 10n ** 6n,
        userAddress: USER_ADDRESS,
        chainId: GNOSIS_CHAIN_ID,
      })
    ).rejects.toThrow("only supported for UUSD");
  });
});
