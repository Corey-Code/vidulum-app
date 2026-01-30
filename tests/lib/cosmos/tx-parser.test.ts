/**
 * Transaction Parser Tests
 *
 * Tests for parsing Cosmos SDK transaction messages
 */

import { parseTransaction, getTransactionSummary } from '@/lib/cosmos/tx-parser';

describe('Transaction Parser', () => {
  describe('parseTransaction', () => {
    it('should parse MsgSend transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [{ denom: 'ubze', amount: '1000000' }],
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: 'Test transaction',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgSend');
      expect(result.messages[0].summary).toContain('Sending');
      expect(result.messages[0].summary).toContain('BZE');
      expect(result.messages[0].summary).toContain('bze1xyz789ghi012');
      expect(result.fee).toContain('BZE');
      expect(result.memo).toBe('Test transaction');
    });

    it('should parse MsgMultiSwap transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: 'bze/x/tradebin/MsgMultiSwap',
            value: {
              creator: 'bze1abc123def456',
              routes: ['pool1', 'pool2'],
              input: { denom: 'ubze', amount: '1000000' },
              min_output: { denom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl', amount: '500000' },
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '500000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgMultiSwap');
      expect(result.messages[0].summary).toContain('Swapping');
      expect(result.messages[0].summary).toContain('BZE');
      expect(result.messages[0].summary).toContain('VDL');
      expect(result.messages[0].summary).toContain('via 2 routes');
    });

    it('should parse MsgDelegate transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgDelegate',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
              amount: { denom: 'ubze', amount: '10000000' },
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgDelegate');
      expect(result.messages[0].summary).toContain('Staking');
      expect(result.messages[0].summary).toContain('10');
      expect(result.messages[0].summary).toContain('BZE');
      expect(result.messages[0].summary).toContain('validator');
    });

    it('should parse MsgUndelegate transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: '/cosmos.staking.v1beta1.MsgUndelegate',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
              amount: { denom: 'ubze', amount: '5000000' },
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgUndelegate');
      expect(result.messages[0].summary).toContain('Unstaking');
      expect(result.messages[0].summary).toContain('BZE');
    });

    it('should parse MsgBeginRedelegate transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_src_address: 'bzevaloper1source',
              validator_dst_address: 'bzevaloper1destination',
              amount: { denom: 'ubze', amount: '3000000' },
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgBeginRedelegate');
      expect(result.messages[0].summary).toContain('Redelegating');
      expect(result.messages[0].summary).toContain('from');
      expect(result.messages[0].summary).toContain('to');
    });

    it('should parse MsgWithdrawDelegatorReward transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgWithdrawDelegatorReward');
      expect(result.messages[0].summary).toContain('Claiming rewards');
      expect(result.messages[0].summary).toContain('validator');
    });

    it('should parse MsgVote transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: '/cosmos.gov.v1beta1.MsgVote',
            value: {
              proposal_id: '42',
              voter: 'bze1abc123def456',
              option: 'VOTE_OPTION_YES',
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgVote');
      expect(result.messages[0].summary).toContain('Voting');
      expect(result.messages[0].summary).toContain('Yes');
      expect(result.messages[0].summary).toContain('proposal #42');
    });

    it('should parse MsgTransfer (IBC) transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: '/ibc.applications.transfer.v1.MsgTransfer',
            value: {
              sender: 'bze1abc123def456',
              receiver: 'cosmos1xyz789ghi012',
              token: { denom: 'ubze', amount: '2000000' },
              source_channel: 'channel-0',
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('MsgTransfer');
      expect(result.messages[0].summary).toContain('Transferring');
      expect(result.messages[0].summary).toContain('BZE');
      expect(result.messages[0].summary).toContain('via IBC');
    });

    it('should handle multiple messages in a transaction', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [{ denom: 'ubze', amount: '1000000' }],
            },
          },
          {
            type: '/cosmos.staking.v1beta1.MsgDelegate',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
              amount: { denom: 'ubze', amount: '5000000' },
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '10000' }],
          gas: '400000',
        },
        memo: 'Multi-message transaction',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].type).toBe('MsgSend');
      expect(result.messages[1].type).toBe('MsgDelegate');
    });

    it('should handle unknown message types gracefully', () => {
      const signDoc = {
        msgs: [
          {
            type: '/custom.module.v1.MsgCustom',
            value: {
              some_field: 'some_value',
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].summary).toContain('not yet supported');
    });

    it('should handle transactions with no fees', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [{ denom: 'ubze', amount: '1000000' }],
            },
          },
        ],
        fee: {
          amount: [],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.fee).toBe('None');
    });

    it('should format IBC token denoms', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [
                {
                  denom: 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4',
                  amount: '1000000',
                },
              ],
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages[0].summary).toContain('IBC-');
    });

    it('should format factory token denoms', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [
                {
                  denom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl',
                  amount: '500000',
                },
              ],
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const result = parseTransaction(signDoc);

      expect(result.messages[0].summary).toContain('VDL');
    });
  });

  describe('getTransactionSummary', () => {
    it('should return a single line summary for single message transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [{ denom: 'ubze', amount: '1000000' }],
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '5000' }],
          gas: '200000',
        },
        memo: '',
      };

      const summary = getTransactionSummary(signDoc);

      expect(summary).toContain('Sending');
      expect(summary).not.toContain('operations');
    });

    it('should return a summary for multi-message transactions', () => {
      const signDoc = {
        msgs: [
          {
            type: 'cosmos-sdk/MsgSend',
            value: {
              from_address: 'bze1abc123def456',
              to_address: 'bze1xyz789ghi012',
              amount: [{ denom: 'ubze', amount: '1000000' }],
            },
          },
          {
            type: '/cosmos.staking.v1beta1.MsgDelegate',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
              amount: { denom: 'ubze', amount: '5000000' },
            },
          },
          {
            type: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
            value: {
              delegator_address: 'bze1abc123def456',
              validator_address: 'bzevaloper1xyz789ghi012',
            },
          },
        ],
        fee: {
          amount: [{ denom: 'ubze', amount: '10000' }],
          gas: '400000',
        },
        memo: '',
      };

      const summary = getTransactionSummary(signDoc);

      expect(summary).toContain('3 operations');
      expect(summary).toContain('and 2 more');
    });

    it('should handle empty transactions', () => {
      const signDoc = {
        msgs: [],
        fee: {
          amount: [],
          gas: '0',
        },
        memo: '',
      };

      const summary = getTransactionSummary(signDoc);

      expect(summary).toBe('Empty transaction');
    });
  });
});
