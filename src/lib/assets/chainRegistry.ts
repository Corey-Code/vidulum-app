// Generated chain registry data. Do not edit by hand; run
// `npm run sync:chains` to regenerate.

export interface ChainInfo {
  chainId: string;
  name: string;
  type: 'cosmos' | 'evm' | 'svm' | 'utxo';
  rpc?: string;
}

export const chainRegistry: ChainInfo[] = [];
