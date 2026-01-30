/**
 * Transaction Parser for Cosmos SDK Messages
 * 
 * Parses transaction messages into human-readable summaries
 */

interface Coin {
  readonly denom: string;
  readonly amount: string;
}

interface ParsedMessage {
  type: string;
  summary: string;
  details?: Record<string, any>;
}

/**
 * Format token amount with proper decimals
 * @param amount - String representation of the token amount in base units (e.g., micro-units)
 * @param decimals - Number of decimal places to convert (default: 6)
 * @returns Formatted amount string with decimals
 * @throws Error if amount string is invalid or not a number
 */
function formatAmount(amount: string, decimals: number = 6): string {
  // Validate input
  if (!amount || amount.trim() === '' || !/^\d+$/.test(amount.trim())) {
    return '0';
  }
  
  try {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const fraction = num % divisor;
    
    if (fraction === BigInt(0)) {
      return whole.toString();
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractionStr}`;
  } catch (error) {
    return '0';
  }
}

/**
 * Format token denomination (remove 'u' prefix, uppercase)
 */
function formatDenom(denom: string): string {
  // Handle factory tokens (e.g., factory/address/uvdl -> VDL)
  if (denom.startsWith('factory/')) {
    const parts = denom.split('/');
    const tokenName = parts[parts.length - 1];
    if (tokenName.startsWith('u')) {
      return tokenName.slice(1).toUpperCase();
    }
    return tokenName.toUpperCase();
  }
  
  // Handle standard tokens (e.g., ubze -> BZE)
  if (denom.startsWith('u')) {
    return denom.slice(1).toUpperCase();
  }
  
  // Handle IBC tokens
  if (denom.startsWith('ibc/')) {
    return 'IBC-' + denom.slice(4, 12).toUpperCase();
  }
  
  return denom.toUpperCase();
}

/**
 * Shorten an address for display
 */
function shortenAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

/**
 * Parse MsgSend - Bank send transaction
 */
function parseMsgSend(msg: any): ParsedMessage {
  const { from_address, to_address, amount } = msg.value || msg;
  const coins = Array.isArray(amount) ? amount : [amount];
  
  const recipient = to_address ? shortenAddress(to_address) : 'unknown address';
  
  if (coins.length === 0) {
    return {
      type: 'MsgSend',
      summary: `Sending to ${recipient}`,
    };
  }
  
  const formattedAmounts = coins.map((coin: Coin) => {
    const amt = formatAmount(coin.amount);
    const denom = formatDenom(coin.denom);
    return `${amt} ${denom}`;
  }).join(', ');
  
  return {
    type: 'MsgSend',
    summary: `Sending ${formattedAmounts} to ${recipient}`,
    details: { from: from_address, to: to_address, amount: coins },
  };
}

/**
 * Parse MsgMultiSwap - BZE Tradebin swap
 */
function parseMsgMultiSwap(msg: any): ParsedMessage {
  const { input, min_output, routes } = msg.value || msg;
  
  const inputAmt = formatAmount(input?.amount || '0');
  const inputDenom = formatDenom(input?.denom || '');
  const outputAmt = formatAmount(min_output?.amount || '0');
  const outputDenom = formatDenom(min_output?.denom || '');
  
  const routeInfo = routes && routes.length > 0 
    ? ` via ${routes.length} route${routes.length > 1 ? 's' : ''}`
    : '';
  
  return {
    type: 'MsgMultiSwap',
    summary: `Swapping ${inputAmt} ${inputDenom} for minimum ${outputAmt} ${outputDenom}${routeInfo}`,
    details: { input, min_output, routes },
  };
}

/**
 * Parse MsgDelegate - Staking delegation
 */
function parseMsgDelegate(msg: any): ParsedMessage {
  const { delegator_address, validator_address, amount } = msg.value || msg;
  
  const amt = formatAmount(amount?.amount || '0');
  const denom = formatDenom(amount?.denom || '');
  const validator = shortenAddress(validator_address || '');
  
  return {
    type: 'MsgDelegate',
    summary: `Staking ${amt} ${denom} with validator ${validator}`,
    details: { delegator: delegator_address, validator: validator_address, amount },
  };
}

/**
 * Parse MsgUndelegate - Unstaking
 */
function parseMsgUndelegate(msg: any): ParsedMessage {
  const { delegator_address, validator_address, amount } = msg.value || msg;
  
  const amt = formatAmount(amount?.amount || '0');
  const denom = formatDenom(amount?.denom || '');
  const validator = shortenAddress(validator_address || '');
  
  return {
    type: 'MsgUndelegate',
    summary: `Unstaking ${amt} ${denom} from validator ${validator}`,
    details: { delegator: delegator_address, validator: validator_address, amount },
  };
}

/**
 * Parse MsgBeginRedelegate - Redelegation
 */
function parseMsgBeginRedelegate(msg: any): ParsedMessage {
  const { delegator_address, validator_src_address, validator_dst_address, amount } = msg.value || msg;
  
  const amt = formatAmount(amount?.amount || '0');
  const denom = formatDenom(amount?.denom || '');
  const srcValidator = shortenAddress(validator_src_address || '');
  const dstValidator = shortenAddress(validator_dst_address || '');
  
  return {
    type: 'MsgBeginRedelegate',
    summary: `Redelegating ${amt} ${denom} from ${srcValidator} to ${dstValidator}`,
    details: { 
      delegator: delegator_address, 
      source: validator_src_address, 
      destination: validator_dst_address, 
      amount 
    },
  };
}

/**
 * Parse MsgWithdrawDelegatorReward - Claim staking rewards
 */
function parseMsgWithdrawDelegatorReward(msg: any): ParsedMessage {
  const { delegator_address, validator_address } = msg.value || msg;
  const validator = shortenAddress(validator_address || '');
  
  return {
    type: 'MsgWithdrawDelegatorReward',
    summary: `Claiming rewards from validator ${validator}`,
    details: { delegator: delegator_address, validator: validator_address },
  };
}

/**
 * Parse MsgVote - Governance vote
 */
// Vote options constant
const VOTE_OPTIONS: Record<string, string> = {
  '1': 'Yes',
  '2': 'Abstain',
  '3': 'No',
  '4': 'No with Veto',
  'VOTE_OPTION_YES': 'Yes',
  'VOTE_OPTION_ABSTAIN': 'Abstain',
  'VOTE_OPTION_NO': 'No',
  'VOTE_OPTION_NO_WITH_VETO': 'No with Veto',
};

function parseMsgVote(msg: any): ParsedMessage {
  const { proposal_id, voter, option } = msg.value || msg;
  
  const voteText = VOTE_OPTIONS[option] || option;
  
  return {
    type: 'MsgVote',
    summary: `Voting "${voteText}" on proposal #${proposal_id}`,
    details: { proposal_id, voter, option },
  };
}

/**
 * Parse MsgTransfer - IBC transfer
 */
function parseMsgTransfer(msg: any): ParsedMessage {
  const { sender, receiver, token, source_channel } = msg.value || msg;
  
  const amt = formatAmount(token?.amount || '0');
  const denom = formatDenom(token?.denom || '');
  const recipient = shortenAddress(receiver || '');
  
  return {
    type: 'MsgTransfer',
    summary: `Transferring ${amt} ${denom} to ${recipient} via IBC`,
    details: { sender, receiver, token, channel: source_channel },
  };
}

/**
 * Parse a single message
 */
function parseMessage(msg: any): ParsedMessage {
  // Handle both Amino and Direct sign formats
  const msgType = msg.type || msg.typeUrl || '';
  
  // Normalize the type URL - remove leading slash and handle both formats
  let normalizedType = msgType;
  if (normalizedType.startsWith('/')) {
    normalizedType = normalizedType.slice(1);
  }
  
  // Extract the message type name (last part after the last '.' or '/')
  const parts = normalizedType.split(/[./]/);
  const baseType = parts[parts.length - 1];
  
  // Parse based on type
  switch (baseType) {
    case 'MsgSend':
      return parseMsgSend(msg);
    case 'MsgMultiSwap':
      return parseMsgMultiSwap(msg);
    case 'MsgDelegate':
      return parseMsgDelegate(msg);
    case 'MsgUndelegate':
      return parseMsgUndelegate(msg);
    case 'MsgBeginRedelegate':
      return parseMsgBeginRedelegate(msg);
    case 'MsgWithdrawDelegatorReward':
      return parseMsgWithdrawDelegatorReward(msg);
    case 'MsgVote':
      return parseMsgVote(msg);
    case 'MsgTransfer':
      return parseMsgTransfer(msg);
    default:
      return {
        type: baseType || 'Unknown',
        summary: `${baseType || 'Unknown transaction'} (not yet supported)`,
        details: msg,
      };
  }
}

/**
 * Parse transaction sign document into human-readable summary
 */
export function parseTransaction(signDoc: any): {
  messages: ParsedMessage[];
  fee: string;
  memo: string;
} {
  // Handle null or undefined signDoc
  if (!signDoc) {
    return {
      messages: [],
      fee: 'Unknown',
      memo: '',
    };
  }
  
  const msgs = signDoc.msgs || signDoc.messages || [];
  const parsedMessages = msgs.map(parseMessage);
  
  // Parse fee
  let feeText = 'Unknown';
  const fee = signDoc.fee;
  if (fee && fee.amount && Array.isArray(fee.amount) && fee.amount.length > 0) {
    const feeCoins = fee.amount.map((coin: Coin) => {
      const amt = formatAmount(coin.amount);
      const denom = formatDenom(coin.denom);
      return `${amt} ${denom}`;
    }).join(', ');
    feeText = feeCoins;
  } else if (fee && fee.amount && Array.isArray(fee.amount) && fee.amount.length === 0) {
    feeText = 'None';
  }
  
  return {
    messages: parsedMessages,
    fee: feeText,
    memo: signDoc.memo || '',
  };
}

/**
 * Get a single-line summary of the transaction
 */
export function getTransactionSummary(signDoc: any): string {
  const parsed = parseTransaction(signDoc);
  
  if (parsed.messages.length === 0) {
    return 'Empty transaction';
  }
  
  if (parsed.messages.length === 1) {
    return parsed.messages[0].summary;
  }
  
  return `${parsed.messages.length} operations: ${parsed.messages[0].summary} and ${parsed.messages.length - 1} more`;
}
