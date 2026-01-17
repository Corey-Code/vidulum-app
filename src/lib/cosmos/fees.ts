/**
 * Fee estimation utilities for Cosmos chains
 */

import { toBase64 } from '@cosmjs/encoding';
import { TxRaw, TxBody, AuthInfo, Fee, SignerInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export interface ChainFeeConfig {
  minimumGasPrice: string; // e.g., "0.01ubze"
  defaultGasLimit: number;
  feeDenom: string;
}

export interface TradebinParams {
  createMarketFee: string;
  marketMakerFee: string;
  marketTakerFee: string;
  makerFeeDestination: string;
  takerFeeDestination: string;
  nativeDenom: string;
}

export interface FeeEstimate {
  amount: string;
  denom: string;
  formatted: string; // Human readable, e.g., "0.005 BZE"
}

export interface SimulateResult {
  gasUsed: number;
  gasWanted: number;
}

// Cache for params
let tradebinParamsCache: TradebinParams | null = null;
let tradebinParamsCacheTime = 0;
let minimumGasPricesCache: Map<string, number> = new Map();
let gasPricesCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch tradebin module params from BeeZee chain
 */
export async function fetchTradebinParams(restEndpoint: string): Promise<TradebinParams> {
  // Check cache
  if (tradebinParamsCache && Date.now() - tradebinParamsCacheTime < CACHE_DURATION) {
    return tradebinParamsCache;
  }

  try {
    const response = await fetch(`${restEndpoint}/bze/tradebin/params`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tradebin params: ${response.status}`);
    }

    const data = await response.json();
    const params = data.params;

    tradebinParamsCache = {
      createMarketFee: params.createMarketFee || '0ubze',
      marketMakerFee: params.marketMakerFee || '0ubze',
      marketTakerFee: params.marketTakerFee || '0ubze',
      makerFeeDestination: params.makerFeeDestination || '',
      takerFeeDestination: params.takerFeeDestination || '',
      nativeDenom: params.native_denom || 'ubze',
    };
    tradebinParamsCacheTime = Date.now();

    return tradebinParamsCache;
  } catch (error) {
    console.error('Failed to fetch tradebin params:', error);
    // Return defaults
    return {
      createMarketFee: '25000000000ubze',
      marketMakerFee: '1000ubze',
      marketTakerFee: '100000ubze',
      makerFeeDestination: 'burner',
      takerFeeDestination: 'burner',
      nativeDenom: 'ubze',
    };
  }
}

/**
 * Fetch minimum gas prices from chain node config
 */
export async function fetchMinimumGasPrices(restEndpoint: string): Promise<Map<string, number>> {
  // Check cache
  if (minimumGasPricesCache.size > 0 && Date.now() - gasPricesCacheTime < CACHE_DURATION) {
    return minimumGasPricesCache;
  }

  try {
    const response = await fetch(`${restEndpoint}/cosmos/base/node/v1beta1/config`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node config: ${response.status}`);
    }

    const data = await response.json();
    const gasPriceStr = data.minimum_gas_price || '';

    // Parse gas prices like "0.01ubze,0.001uvdl"
    const prices = new Map<string, number>();
    const parts = gasPriceStr.split(',');

    for (const part of parts) {
      // Match pattern like "0.01ubze" or "0.000001ibc/..."
      const match = part.match(/^([\d.]+)(.+)$/);
      if (match) {
        const price = parseFloat(match[1]);
        const denom = match[2];
        prices.set(denom, price);
      }
    }

    minimumGasPricesCache = prices;
    gasPricesCacheTime = Date.now();

    return prices;
  } catch (error) {
    console.error('Failed to fetch minimum gas prices:', error);
    // Return default for BZE
    return new Map([['ubze', 0.01]]);
  }
}

/**
 * Parse fee string like "100000ubze" into amount and denom
 */
export function parseFeeString(feeStr: string): { amount: string; denom: string } {
  const match = feeStr.match(/^(\d+)(.+)$/);
  if (match) {
    return { amount: match[1], denom: match[2] };
  }
  return { amount: '0', denom: 'ubze' };
}

/**
 * Simulate a transaction to get accurate gas estimate
 */
export async function simulateTransaction(
  restEndpoint: string,
  txBodyBytes: Uint8Array,
  authInfoBytes: Uint8Array
): Promise<SimulateResult> {
  try {
    // Create TxRaw with proper encoding - needs at least one empty signature
    const txRaw = TxRaw.fromPartial({
      bodyBytes: txBodyBytes,
      authInfoBytes: authInfoBytes,
      signatures: [new Uint8Array(0)], // Empty signature for simulation
    });

    const txBytes = TxRaw.encode(txRaw).finish();

    const response = await fetch(`${restEndpoint}/cosmos/tx/v1beta1/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_bytes: toBase64(txBytes),
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      // The simulation may fail with sequence mismatch but still return gas used in error
      // Example: "account sequence mismatch... with gas used: '70305'"
      const gasMatch = responseText.match(/gas used[:\s'"]*(\d+)/i);
      if (gasMatch) {
        const gasUsed = parseInt(gasMatch[1]);
        console.log(`Extracted gas from error response: ${gasUsed}`);
        return {
          gasUsed,
          gasWanted: gasUsed,
        };
      }
      console.error('Simulate error:', responseText);
      throw new Error(`Simulation failed: ${response.status}`);
    }

    const data = JSON.parse(responseText);
    return {
      gasUsed: parseInt(data.gas_info?.gas_used || '0'),
      gasWanted: parseInt(data.gas_info?.gas_wanted || '0'),
    };
  } catch (error) {
    console.error('Failed to simulate transaction:', error);
    throw error;
  }
}

/**
 * Simulate a send transaction and return fee estimate
 */
export async function simulateSendFee(
  restEndpoint: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  denom: string,
  pubKey: Uint8Array
): Promise<{ gas: number; fee: FeeEstimate }> {
  const MIN_GAS_PRICE = 0.01; // ubze per gas

  try {
    // Build MsgSend
    const msgSend = MsgSend.fromPartial({
      fromAddress,
      toAddress,
      amount: [Coin.fromPartial({ denom, amount })],
    });

    const txBodyBytes = TxBody.encode(
      TxBody.fromPartial({
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: MsgSend.encode(msgSend).finish(),
          },
        ],
        memo: '',
      })
    ).finish();

    const pubKeyProto = PubKey.fromPartial({ key: pubKey });
    const authInfoBytes = AuthInfo.encode(
      AuthInfo.fromPartial({
        signerInfos: [
          SignerInfo.fromPartial({
            publicKey: {
              typeUrl: '/cosmos.crypto.secp256k1.PubKey',
              value: PubKey.encode(pubKeyProto).finish(),
            },
            modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
            sequence: BigInt(0), // Will be filled during actual tx
          }),
        ],
        fee: Fee.fromPartial({
          amount: [],
          gasLimit: BigInt(0),
        }),
      })
    ).finish();

    const simResult = await simulateTransaction(restEndpoint, txBodyBytes, authInfoBytes);

    // Add 100% buffer (double) to gas estimate to account for variability
    // Also ensure minimum of 150k gas for safety
    const gasWithBuffer = Math.max(Math.ceil(simResult.gasUsed * 2), 150000);
    const feeAmount = Math.ceil(gasWithBuffer * MIN_GAS_PRICE);

    console.log(`Simulation: gasUsed=${simResult.gasUsed}, withBuffer=${gasWithBuffer}`);

    return {
      gas: gasWithBuffer,
      fee: {
        amount: feeAmount.toString(),
        denom: 'ubze',
        formatted: `${(feeAmount / 1_000_000).toFixed(6)} BZE`,
      },
    };
  } catch (error) {
    console.error('Failed to simulate send fee:', error);
    // Fallback to higher default estimate
    const defaultGas = 150000;
    const feeAmount = Math.ceil(defaultGas * MIN_GAS_PRICE);
    return {
      gas: defaultGas,
      fee: {
        amount: feeAmount.toString(),
        denom: 'ubze',
        formatted: `${(feeAmount / 1_000_000).toFixed(6)} BZE`,
      },
    };
  }
}

/**
 * Estimate transaction fee for a send transaction (simple version without simulation)
 */
export async function estimateSendFee(
  restEndpoint: string,
  gasLimit: number = 100000
): Promise<FeeEstimate> {
  const gasPrices = await fetchMinimumGasPrices(restEndpoint);
  const bzePrice = gasPrices.get('ubze') || 0.01;

  // Calculate fee: gasLimit * gasPrice
  const feeAmount = Math.ceil(gasLimit * bzePrice);

  return {
    amount: feeAmount.toString(),
    denom: 'ubze',
    formatted: `${(feeAmount / 1_000_000).toFixed(6)} BZE`,
  };
}

/**
 * Estimate swap fee (includes tradebin taker fee)
 */
export async function estimateSwapFee(
  restEndpoint: string,
  gasLimit: number = 250000
): Promise<{ txFee: FeeEstimate; tradeFee: FeeEstimate }> {
  // Get transaction fee
  const txFee = await estimateSendFee(restEndpoint, gasLimit);

  // Get tradebin taker fee
  const tradebinParams = await fetchTradebinParams(restEndpoint);
  const { amount: takerFeeAmount, denom: takerFeeDenom } = parseFeeString(
    tradebinParams.marketTakerFee
  );

  const tradeFee: FeeEstimate = {
    amount: takerFeeAmount,
    denom: takerFeeDenom,
    formatted: `${(parseInt(takerFeeAmount) / 1_000_000).toFixed(6)} BZE`,
  };

  return { txFee, tradeFee };
}

/**
 * Get default fee config for a chain
 */
export function getDefaultFeeConfig(chainId: string): ChainFeeConfig {
  switch (chainId) {
    case 'beezee-1':
      return {
        minimumGasPrice: '0.01ubze',
        defaultGasLimit: 100000,
        feeDenom: 'ubze',
      };
    case 'osmosis-1':
      return {
        minimumGasPrice: '0.0025uosmo',
        defaultGasLimit: 200000,
        feeDenom: 'uosmo',
      };
    default:
      return {
        minimumGasPrice: '0.01',
        defaultGasLimit: 100000,
        feeDenom: '',
      };
  }
}
