import type {
  AddAccountFlow,
  ApprovalStatus,
  CreateWalletFlow,
  IbcFlow,
  SendFlow,
  SwapFlow,
} from '@/types/flows';

function assertNever(x: never): never {
  throw new Error(`unexpected: ${x}`);
}

describe('flow discriminants', () => {
  it('ApprovalStatus covers terminal and active phases', () => {
    const statuses: ApprovalStatus[] = [
      'pending',
      'awaiting_user',
      'approved',
      'rejected',
      'timed_out',
      'orphaned',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('CreateWalletFlow folds busy into password step', () => {
    const password: CreateWalletFlow = { step: 'password', busy: true };
    const mnemonic: CreateWalletFlow = {
      step: 'mnemonic',
      mnemonic: 'word '.repeat(12).trim(),
      confirmed: false,
    };
    expect(password.busy).toBe(true);
    expect(mnemonic.confirmed).toBe(false);
  });

  it('SendFlow / SwapFlow / IbcFlow encode busy without parallel booleans', () => {
    const send: SendFlow = { step: 'input', busy: 'fee' };
    const swap: SwapFlow = { step: 'input', busy: 'quote' };
    const ibc: IbcFlow = { step: 'transferring' };
    expect(send.busy).toBe('fee');
    expect(swap.busy).toBe('quote');
    expect(ibc.step).toBe('transferring');
  });

  it('AddAccountFlow has no dead create step', () => {
    const steps: AddAccountFlow['step'][] = [
      'none',
      'choose',
      'select-source',
      'derive-from-source',
      'create-new',
      'show-mnemonic',
      'import',
      'import-key',
      'import-mnemonic',
    ];
    expect(steps).not.toContain('create' as AddAccountFlow['step']);

    const flow: AddAccountFlow = { step: 'show-mnemonic', mnemonic: 'a b c', confirmed: true };
    switch (flow.step) {
      case 'show-mnemonic':
        expect(flow.confirmed).toBe(true);
        break;
      case 'none':
      case 'choose':
      case 'select-source':
      case 'derive-from-source':
      case 'create-new':
      case 'import':
      case 'import-key':
      case 'import-mnemonic':
        break;
      default:
        assertNever(flow);
    }
  });
});
