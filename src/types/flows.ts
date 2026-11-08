import type { ParsedTransaction } from '@/lib/cosmos/tx-parser';

/** Persisted dApp approval lifecycle (background service worker). */
export type ApprovalStatus =
  | 'pending'
  | 'awaiting_user'
  | 'approved'
  | 'rejected'
  | 'timed_out'
  | 'orphaned';

export type ApprovalKind = 'connection' | 'transaction' | 'signing';

export interface StoredApprovalRecord {
  id: string;
  type: ApprovalKind;
  origin: string;
  data: unknown;
  createdAt: number;
  status: ApprovalStatus;
}

/** Approval.tsx UI machine. */
export type ApprovalUiState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      approval: {
        id: string;
        type: ApprovalKind;
        origin: string;
        data: any;
      };
      responding: boolean;
      showRawTx: boolean;
      txParse:
        | { status: 'idle' }
        | { status: 'parsing' }
        | {
            status: 'done';
            parsed: {
              messages: ParsedTransaction[];
              chainId: string;
              memo?: string;
            };
          }
        | { status: 'failed' };
    };

/** Create-wallet wizard. */
export type CreateWalletFlow =
  | { step: 'password'; busy: boolean }
  | { step: 'mnemonic'; mnemonic: string; confirmed: boolean };

/** Send modal wizard (busy folded into step). */
export type SendFlow =
  | { step: 'loading_assets' }
  | { step: 'input'; busy?: 'fee' | 'max' }
  | { step: 'confirm' }
  | { step: 'sending' };

/** Swap modal wizard. */
export type SwapFlow =
  | { step: 'loading_pools' }
  | { step: 'input'; busy?: 'quote' }
  | { step: 'confirm' }
  | { step: 'password' }
  | { step: 'swapping' };

/** IBC transfer wizard. */
export type IbcFlow =
  | { step: 'loading_connections' }
  | { step: 'select-destination' }
  | { step: 'input-amount' }
  | { step: 'confirm' }
  | { step: 'password' }
  | { step: 'transferring' };

/** Dashboard add-account wizard (dead `create` step removed). */
export type AddAccountFlow =
  | { step: 'none' }
  | { step: 'choose' }
  | { step: 'select-source' }
  | { step: 'derive-from-source'; busy: boolean }
  | { step: 'create-new'; busy: boolean }
  | { step: 'show-mnemonic'; mnemonic: string; confirmed: boolean }
  | { step: 'import' }
  | { step: 'import-key' }
  | { step: 'import-mnemonic'; busy: boolean };
