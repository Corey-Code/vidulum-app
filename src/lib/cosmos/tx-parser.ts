/**
 * Transaction Parser - Converts raw Cosmos transaction messages to human-readable format
 */

import { fetchChainAssets } from '@/lib/assets/chainRegistry';

// Cache for asset info
const assetCache = new Map<string, { symbol: string; decimals: number }>();

/**
 * Resolve a denom to its symbol and decimals
 */
export async function resolveDenom(
  chainId: string,
  denom: string
): Promise<{ symbol: string; decimals: number }> {
  const cacheKey = `${chainId}:${denom}`;

  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey)!;
  }

  try {
    const assets = await fetchChainAssets(chainId);
    const asset = assets.find((a) => a.denom === denom);

    if (asset) {
      const result = { symbol: asset.symbol, decimals: asset.decimals };
      assetCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Ignore errors
  }

  // Fallback: try to extract symbol from denom
  const fallback = { symbol: formatDenom(denom), decimals: 6 };
  assetCache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Format a raw denom to a readable symbol
 */
function formatDenom(denom: string): string {
  // Handle factory denoms: factory/bze.../uvdl -> VDL
  if (denom.startsWith('factory/')) {
    const parts = denom.split('/');
    const lastPart = parts[parts.length - 1];
    // Remove 'u' prefix if present
    return lastPart.startsWith('u') ? lastPart.slice(1).toUpperCase() : lastPart.toUpperCase();
  }

  // Handle IBC denoms: ibc/ABC123... -> IBC/ABC1...
  if (denom.startsWith('ibc/')) {
    return `IBC/${denom.slice(4, 8)}...`;
  }

  // Handle micro denoms: ubze -> BZE
  if (denom.startsWith('u') && denom.length > 1) {
    return denom.slice(1).toUpperCase();
  }

  return denom.toUpperCase();
}

/**
 * Format an amount with decimals
 */
export function formatAmount(amount: string, decimals: number): string {
  const value = parseInt(amount) / Math.pow(10, decimals);
  // Remove trailing zeros
  return value.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Parsed transaction summary
 */
export interface ParsedTransaction {
  type: string;
  summary: string;
  details: Record<string, string>;
  rawMsg: unknown;
}

/**
 * Parse a Cosmos transaction message into human-readable format
 */
export async function parseTransactionMessage(
  chainId: string,
  msg: { type?: string; typeUrl?: string; value?: any }
): Promise<ParsedTransaction> {
  const msgType = msg.type || msg.typeUrl || 'unknown';

  // MsgMultiSwap - Swap transaction
  if (msgType.includes('MsgMultiSwap') || msgType.includes('tradebin')) {
    return parseSwapMessage(chainId, msg.value);
  }

  // MsgSend - Token transfer
  if (msgType.includes('MsgSend') || msgType.includes('bank')) {
    return parseSendMessage(chainId, msg.value);
  }

  // MsgDelegate - Stake tokens
  if (msgType.includes('MsgDelegate') && !msgType.includes('Undelegate')) {
    return parseDelegateMessage(chainId, msg.value);
  }

  // MsgUndelegate - Unstake tokens
  if (msgType.includes('MsgUndelegate')) {
    return parseUndelegateMessage(chainId, msg.value);
  }

  // MsgWithdrawDelegatorReward - Claim rewards
  if (msgType.includes('MsgWithdrawDelegatorReward')) {
    return parseWithdrawRewardsMessage(chainId, msg.value);
  }

  // MsgVote - Governance vote
  if (msgType.includes('MsgVote')) {
    return parseVoteMessage(chainId, msg.value);
  }

  // Unknown message type
  return {
    type: msgType.split('/').pop() || msgType,
    summary: `Execute ${msgType.split('/').pop() || 'transaction'}`,
    details: {},
    rawMsg: msg,
  };
}

/**
 * Parse MsgMultiSwap (Swap)
 */
async function parseSwapMessage(chainId: string, value: any): Promise<ParsedTransaction> {
  const input = value.input || {};
  const minOutput = value.min_output || value.minOutput || {};
  const routes = value.routes || [];

  const inputDenom = await resolveDenom(chainId, input.denom || '');
  const outputDenom = await resolveDenom(chainId, minOutput.denom || '');

  const inputAmount = formatAmount(input.amount || '0', inputDenom.decimals);
  const outputAmount = formatAmount(minOutput.amount || '0', outputDenom.decimals);

  const summary = `Swapping ${inputAmount} ${inputDenom.symbol} for a minimum of ${outputAmount} ${outputDenom.symbol}`;

  return {
    type: 'Swap',
    summary,
    details: {
      'You Send': `${inputAmount} ${inputDenom.symbol}`,
      'Min. Receive': `${outputAmount} ${outputDenom.symbol}`,
      Route: routes.length > 1 ? `${routes.length} pools` : '1 pool',
    },
    rawMsg: value,
  };
}

/**
 * Parse MsgSend (Transfer)
 */
async function parseSendMessage(chainId: string, value: any): Promise<ParsedTransaction> {
  const toAddress = value.toAddress || value.to_address || '';
  const amounts = value.amount || [];

  if (amounts.length === 0) {
    return {
      type: 'Send',
      summary: 'Send tokens',
      details: { To: toAddress },
      rawMsg: value,
    };
  }

  const coin = amounts[0];
  const denomInfo = await resolveDenom(chainId, coin.denom || '');
  const amount = formatAmount(coin.amount || '0', denomInfo.decimals);

  const shortAddress = `${toAddress.slice(0, 10)}...${toAddress.slice(-6)}`;
  const summary = `Sending ${amount} ${denomInfo.symbol} to ${shortAddress}`;

  return {
    type: 'Send',
    summary,
    details: {
      Amount: `${amount} ${denomInfo.symbol}`,
      To: toAddress,
    },
    rawMsg: value,
  };
}

/**
 * Parse MsgDelegate (Stake)
 */
async function parseDelegateMessage(chainId: string, value: any): Promise<ParsedTransaction> {
  const validatorAddress = value.validatorAddress || value.validator_address || '';
  const coin = value.amount || {};

  const denomInfo = await resolveDenom(chainId, coin.denom || '');
  const amount = formatAmount(coin.amount || '0', denomInfo.decimals);

  const shortValidator = `${validatorAddress.slice(0, 15)}...${validatorAddress.slice(-6)}`;
  const summary = `Staking ${amount} ${denomInfo.symbol} with ${shortValidator}`;

  return {
    type: 'Stake',
    summary,
    details: {
      Amount: `${amount} ${denomInfo.symbol}`,
      Validator: validatorAddress,
    },
    rawMsg: value,
  };
}

/**
 * Parse MsgUndelegate (Unstake)
 */
async function parseUndelegateMessage(chainId: string, value: any): Promise<ParsedTransaction> {
  const validatorAddress = value.validatorAddress || value.validator_address || '';
  const coin = value.amount || {};

  const denomInfo = await resolveDenom(chainId, coin.denom || '');
  const amount = formatAmount(coin.amount || '0', denomInfo.decimals);

  const shortValidator = `${validatorAddress.slice(0, 15)}...${validatorAddress.slice(-6)}`;
  const summary = `Unstaking ${amount} ${denomInfo.symbol} from ${shortValidator}`;

  return {
    type: 'Unstake',
    summary,
    details: {
      Amount: `${amount} ${denomInfo.symbol}`,
      Validator: validatorAddress,
      Note: 'Tokens will be available after unbonding period',
    },
    rawMsg: value,
  };
}

/**
 * Parse MsgWithdrawDelegatorReward (Claim Rewards)
 */
async function parseWithdrawRewardsMessage(
  _chainId: string,
  value: any
): Promise<ParsedTransaction> {
  const validatorAddress = value.validatorAddress || value.validator_address || '';
  const shortValidator = `${validatorAddress.slice(0, 15)}...${validatorAddress.slice(-6)}`;

  return {
    type: 'Claim Rewards',
    summary: `Claiming staking rewards from ${shortValidator}`,
    details: {
      Validator: validatorAddress,
    },
    rawMsg: value,
  };
}

/**
 * Parse MsgVote (Governance Vote)
 */
async function parseVoteMessage(_chainId: string, value: any): Promise<ParsedTransaction> {
  const proposalId = value.proposalId || value.proposal_id || '';
  const option = value.option || '';

  const voteOptions: Record<number | string, string> = {
    1: 'Yes',
    2: 'Abstain',
    3: 'No',
    4: 'No with Veto',
    VOTE_OPTION_YES: 'Yes',
    VOTE_OPTION_ABSTAIN: 'Abstain',
    VOTE_OPTION_NO: 'No',
    VOTE_OPTION_NO_WITH_VETO: 'No with Veto',
  };

  const voteText = voteOptions[option] || option;

  return {
    type: 'Vote',
    summary: `Voting ${voteText} on proposal #${proposalId}`,
    details: {
      Proposal: `#${proposalId}`,
      Vote: voteText,
    },
    rawMsg: value,
  };
}

/**
 * Parse multiple messages from a sign doc
 */
export async function parseSignDoc(
  chainId: string,
  signDoc: any
): Promise<{ messages: ParsedTransaction[]; chainId: string; memo?: string }> {
  const msgs = signDoc.msgs || signDoc.messages || [];
  const memo = signDoc.memo || '';

  const parsedMessages: ParsedTransaction[] = [];

  for (const msg of msgs) {
    const parsed = await parseTransactionMessage(chainId, msg);
    parsedMessages.push(parsed);
  }

  return {
    messages: parsedMessages,
    chainId: signDoc.chain_id || signDoc.chainId || chainId,
    memo: memo || undefined,
  };
}
