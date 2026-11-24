/**
 * Cosmos governance helpers (BeeZee MsgVote + LCD normalize)
 */

import {
  MSG_VOTE_TYPE_URL,
  VoteOption,
  VOTE_OPTION_LABELS,
  createMsgVote,
  demoGovernanceProposals,
  explorerGovHomeUrl,
  explorerProposalUrl,
  fetchProposals,
  isVotingPeriod,
  normalizeProposal,
  parseVoteOption,
  proposalStatusColor,
  proposalStatusLabel,
  tallyTotals,
} from '@/lib/cosmos/governance';
import { setDemoSession } from '@/lib/demo/session';
import { mockFetchResponse } from '../../setup';

describe('governance helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDemoSession(false);
  });

  afterEach(() => {
    setDemoSession(false);
  });

  describe('createMsgVote', () => {
    it('builds cosmos.gov.v1 MsgVote with BigInt proposal id', () => {
      const msg = createMsgVote('50', 'bze1voter', VoteOption.YES);
      expect(msg.typeUrl).toBe(MSG_VOTE_TYPE_URL);
      expect(msg.typeUrl).toBe('/cosmos.gov.v1.MsgVote');
      expect(msg.value.voter).toBe('bze1voter');
      expect(msg.value.option).toBe(1);
      expect(msg.value.proposalId).toBe(50n);
      expect(msg.value.metadata).toBe('');
    });

    it('supports all four vote options', () => {
      expect(createMsgVote(1, 'bze1a', VoteOption.YES).value.option).toBe(1);
      expect(createMsgVote(1, 'bze1a', VoteOption.ABSTAIN).value.option).toBe(2);
      expect(createMsgVote(1, 'bze1a', VoteOption.NO).value.option).toBe(3);
      expect(createMsgVote(1, 'bze1a', VoteOption.NO_WITH_VETO).value.option).toBe(4);
      expect(VOTE_OPTION_LABELS[VoteOption.NO_WITH_VETO]).toBe('No with Veto');
    });
  });

  describe('normalizeProposal', () => {
    it('maps gov v1 proposal fields', () => {
      const p = normalizeProposal({
        id: '50',
        title: 'Halt USDC.n',
        summary: 'Halt tokens',
        status: 'PROPOSAL_STATUS_PASSED',
        voting_start_time: '2026-10-26T23:30:45Z',
        voting_end_time: '2026-10-31T23:30:45Z',
        submit_time: '2026-10-26T23:30:45Z',
        final_tally_result: {
          yes_count: '100',
          abstain_count: '0',
          no_count: '0',
          no_with_veto_count: '0',
        },
        proposer: 'bze1x',
      });
      expect(p.id).toBe('50');
      expect(p.title).toBe('Halt USDC.n');
      expect(p.summary).toBe('Halt tokens');
      expect(p.status).toBe('PROPOSAL_STATUS_PASSED');
      expect(p.tally.yes).toBe('100');
      expect(p.proposer).toBe('bze1x');
    });

    it('maps v1beta1 proposal_id + content title', () => {
      const p = normalizeProposal({
        proposal_id: '12',
        content: {
          '@type': '/cosmos.gov.v1beta1.TextProposal',
          title: 'Legacy title',
          description: 'Legacy body',
        },
        status: 'PROPOSAL_STATUS_VOTING_PERIOD',
        final_tally_result: { yes: '1', abstain: '0', no: '0', no_with_veto: '0' },
      });
      expect(p.id).toBe('12');
      expect(p.title).toBe('Legacy title');
      expect(p.summary).toBe('Legacy body');
      expect(isVotingPeriod(p.status)).toBe(true);
    });
  });

  describe('status + tally helpers', () => {
    it('labels and colors voting vs passed', () => {
      expect(proposalStatusLabel('PROPOSAL_STATUS_VOTING_PERIOD')).toBe('Voting');
      expect(proposalStatusColor('PROPOSAL_STATUS_VOTING_PERIOD')).toBe('cyan');
      expect(proposalStatusLabel('PROPOSAL_STATUS_PASSED')).toBe('Passed');
      expect(proposalStatusColor('PROPOSAL_STATUS_PASSED')).toBe('green');
    });

    it('computes tally percents', () => {
      const { total, percents } = tallyTotals({
        yes: '50',
        abstain: '25',
        no: '25',
        noWithVeto: '0',
      });
      expect(total).toBe(100);
      expect(percents.yes).toBe(50);
      expect(percents.abstain).toBe(25);
      expect(percents.no).toBe(25);
    });
  });

  describe('parseVoteOption', () => {
    it('parses enum strings and numbers', () => {
      expect(parseVoteOption('VOTE_OPTION_YES')).toBe(VoteOption.YES);
      expect(parseVoteOption('VOTE_OPTION_NO_WITH_VETO')).toBe(VoteOption.NO_WITH_VETO);
      expect(parseVoteOption(3)).toBe(VoteOption.NO);
      expect(parseVoteOption(null)).toBeNull();
    });
  });

  describe('explorer urls', () => {
    it('points at getbze explorer', () => {
      expect(explorerGovHomeUrl()).toBe('https://explorer.getbze.com/beezee/gov');
      expect(explorerProposalUrl('50')).toBe('https://explorer.getbze.com/beezee/gov/50');
    });
  });

  describe('fetchProposals', () => {
    it('returns demo stubs when demo session is active', async () => {
      setDemoSession(true);
      const list = await fetchProposals('https://rest.getbze.com');
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((p) => isVotingPeriod(p.status))).toBe(true);
      expect(demoGovernanceProposals()[0].id).toBe('9001');
    });

    it('normalizes LCD v1 response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          proposals: [
            {
              id: '48',
              title: 'Upgrade',
              summary: 'v8',
              status: 'PROPOSAL_STATUS_PASSED',
              voting_start_time: '2026-01-01T00:00:00Z',
              voting_end_time: '2026-01-05T00:00:00Z',
              submit_time: '2026-01-01T00:00:00Z',
              final_tally_result: {
                yes_count: '10',
                abstain_count: '0',
                no_count: '0',
                no_with_veto_count: '0',
              },
            },
          ],
        })
      );

      const list = await fetchProposals(['https://rest.getbze.com']);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('48');
      expect(list[0].title).toBe('Upgrade');
    });
  });
});
