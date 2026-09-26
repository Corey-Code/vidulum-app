export interface ChainEntry {
  id: string;
  name: string;
  kind: 'cosmos' | 'evm' | 'svm' | 'utxo';
}

export const chainRegistry: ChainEntry[] = [];
