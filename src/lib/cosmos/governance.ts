/**
 * Cosmos SDK governance helpers (BeeZee gov v1 LCD + MsgVote).
 */
import { fetchWithFailover } from '@/lib/networks';
import { isDemoSession } from '@/lib/demo/session';

function normalizeEndpoints(endpoints: string | string[]): string[] {
  return Array.isArray(endpoints) ? endpoints : [endpoints];
}

/** VoteOption enum values from cosmos.gov.v1 */
export const VoteOption = {
  UNSPECIFIED: 0,
  YES: 1,
  ABSTAIN: 2,
  NO: 3,
  NO_WITH_VETO: 4,
} as const;

export type VoteOptionValue = (typeof VoteOption)[keyof typeof VoteOption];

export const VOTE_OPTION_LABELS: Record<VoteOptionValue, string> = {
  [VoteOption.UNSPECIFIED]: 'Unspecified',
  [VoteOption.YES]: 'Yes',
  [VoteOption.ABSTAIN]: 'Abstain',
  [VoteOption.NO]: 'No',
  [VoteOption.NO_WITH_VETO]: 'No with Veto',
};

export const MSG_VOTE_TYPE_URL = '/cosmos.gov.v1.MsgVote' as const;

export type ProposalStatus =
  | 'PROPOSAL_STATUS_UNSPECIFIED'
  | 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  | 'PROPOSAL_STATUS_VOTING_PERIOD'
  | 'PROPOSAL_STATUS_PASSED'
  | 'PROPOSAL_STATUS_REJECTED'
  | 'PROPOSAL_STATUS_FAILED'
  | string;

export interface ProposalTally {
  yes: string;
  abstain: string;
  no: string;
  noWithVeto: string;
}

export interface GovernanceProposal {
  id: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  votingStartTime: string;
  votingEndTime: string;
  submitTime: string;
  tally: ProposalTally;
  proposer?: string;
  expedited?: boolean;
}

export interface VoteChoice {
  option: VoteOptionValue;
  label: string;
}

export const VOTE_CHOICES: VoteChoice[] = [
  { option: VoteOption.YES, label: VOTE_OPTION_LABELS[VoteOption.YES] },
  { option: VoteOption.NO, label: VOTE_OPTION_LABELS[VoteOption.NO] },
  { option: VoteOption.ABSTAIN, label: VOTE_OPTION_LABELS[VoteOption.ABSTAIN] },
  { option: VoteOption.NO_WITH_VETO, label: VOTE_OPTION_LABELS[VoteOption.NO_WITH_VETO] },
];

function emptyTally(): ProposalTally {
  return { yes: '0', abstain: '0', no: '0', noWithVeto: '0' };
}

function parseTally(raw: Record<string, string> | undefined): ProposalTally {
  if (!raw) return emptyTally();
  return {
    yes: raw.yes_count ?? raw.yes ?? '0',
    abstain: raw.abstain_count ?? raw.abstain ?? '0',
    no: raw.no_count ?? raw.no ?? '0',
    noWithVeto: raw.no_with_veto_count ?? raw.no_with_veto ?? '0',
  };
}

function titleFromContent(content: { title?: string; '@type'?: string } | undefined): string {
  if (!content) return 'Untitled proposal';
  if (content.title) return content.title;
  const type = content['@type'] || '';
  const short = type.split('.').pop() || type;
  return short || 'Untitled proposal';
}

/** Normalize gov v1 or v1beta1 proposal JSON into a shared shape. */
export function normalizeProposal(raw: Record<string, unknown>): GovernanceProposal {
  const id = String(raw.id ?? raw.proposal_id ?? '');
  const content = raw.content as { title?: string; description?: string; '@type'?: string } | undefined;
  const title =
    (typeof raw.title === 'string' && raw.title) ||
    titleFromContent(content) ||
    `Proposal #${id}`;
  const summary =
    (typeof raw.summary === 'string' && raw.summary) ||
    content?.description ||
    '';

  return {
    id,
    title,
    summary,
    status: String(raw.status || 'PROPOSAL_STATUS_UNSPECIFIED'),
    votingStartTime: String(raw.voting_start_time || ''),
    votingEndTime: String(raw.voting_end_time || ''),
    submitTime: String(raw.submit_time || ''),
    tally: parseTally(raw.final_tally_result as Record<string, string> | undefined),
    proposer: typeof raw.proposer === 'string' ? raw.proposer : undefined,
    expedited: Boolean(raw.expedited),
  };
}

export function isVotingPeriod(status: ProposalStatus): boolean {
  return status === 'PROPOSAL_STATUS_VOTING_PERIOD' || status === '2';
}

export function proposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD':
    case '1':
      return 'Deposit';
    case 'PROPOSAL_STATUS_VOTING_PERIOD':
    case '2':
      return 'Voting';
    case 'PROPOSAL_STATUS_PASSED':
    case '3':
      return 'Passed';
    case 'PROPOSAL_STATUS_REJECTED':
    case '4':
      return 'Rejected';
    case 'PROPOSAL_STATUS_FAILED':
    case '5':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

export function proposalStatusColor(status: ProposalStatus): string {
  switch (status) {
    case 'PROPOSAL_STATUS_VOTING_PERIOD':
    case '2':
      return 'cyan';
    case 'PROPOSAL_STATUS_PASSED':
    case '3':
      return 'green';
    case 'PROPOSAL_STATUS_REJECTED':
    case '4':
      return 'red';
    case 'PROPOSAL_STATUS_FAILED':
    case '5':
      return 'orange';
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD':
    case '1':
      return 'yellow';
    default:
      return 'gray';
  }
}

export function formatVotingEnd(iso: string): string {
  if (!iso || iso.startsWith('0001-')) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function tallyTotals(tally: ProposalTally): {
  total: number;
  percents: { yes: number; abstain: number; no: number; noWithVeto: number };
} {
  const yes = Number(tally.yes) || 0;
  const abstain = Number(tally.abstain) || 0;
  const no = Number(tally.no) || 0;
  const noWithVeto = Number(tally.noWithVeto) || 0;
  const total = yes + abstain + no + noWithVeto;
  if (total <= 0) {
    return { total: 0, percents: { yes: 0, abstain: 0, no: 0, noWithVeto: 0 } };
  }
  return {
    total,
    percents: {
      yes: (yes / total) * 100,
      abstain: (abstain / total) * 100,
      no: (no / total) * 100,
      noWithVeto: (noWithVeto / total) * 100,
    },
  };
}

/**
 * Build cosmos.gov.v1 MsgVote for Direct signing (registry already includes this type).
 * proposalId must be BigInt for cosmjs-types encode.
 */
export function createMsgVote(
  proposalId: string | number,
  voter: string,
  option: VoteOptionValue,
  metadata = ''
): { typeUrl: typeof MSG_VOTE_TYPE_URL; value: { proposalId: bigint; voter: string; option: number; metadata: string } } {
  return {
    typeUrl: MSG_VOTE_TYPE_URL,
    value: {
      proposalId: BigInt(proposalId),
      voter,
      option,
      metadata,
    },
  };
}

export function explorerProposalUrl(proposalId: string): string {
  return `https://explorer.getbze.com/beezee/gov/${proposalId}`;
}

export function explorerGovHomeUrl(): string {
  return 'https://explorer.getbze.com/beezee/gov';
}

/** Demo stubs so governance UI is usable without chain calls. */
export function demoGovernanceProposals(): GovernanceProposal[] {
  const now = Date.now();
  const inFiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
  const started = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const ended = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: '9001',
      title: 'Demo: Enable community pool spend for docs',
      summary:
        'Demo proposal only. Voting here does not leave this browser. Choose Yes / No / Abstain / No with Veto to exercise the flow.',
      status: 'PROPOSAL_STATUS_VOTING_PERIOD',
      votingStartTime: started,
      votingEndTime: inFiveDays,
      submitTime: started,
      tally: {
        yes: '420000000000',
        abstain: '15000000000',
        no: '8000000000',
        noWithVeto: '1000000000',
      },
      expedited: false,
    },
    {
      id: '50',
      title: 'Halt Noble USDC (USDC.n) and closed-chain tokens (demo copy)',
      summary: 'Historical demo copy of a passed BeeZee proposal. Read-only in demo mode.',
      status: 'PROPOSAL_STATUS_PASSED',
      votingStartTime: ended,
      votingEndTime: ended,
      submitTime: ended,
      tally: {
        yes: '139745843255500',
        abstain: '0',
        no: '0',
        noWithVeto: '0',
      },
    },
  ];
}

/**
 * Fetch proposals from cosmos.gov.v1 (preferred) with v1beta1 fallback.
 */
export async function fetchProposals(
  restEndpoints: string | string[],
  options: { limit?: number; reverse?: boolean } = {}
): Promise<GovernanceProposal[]> {
  if (isDemoSession()) {
    return demoGovernanceProposals();
  }

  const endpoints = normalizeEndpoints(restEndpoints);
  const limit = options.limit ?? 50;
  const reverse = options.reverse ?? true;
  const query = `pagination.limit=${limit}&pagination.reverse=${reverse ? 'true' : 'false'}`;

  try {
    const data = await fetchWithFailover<{ proposals?: Record<string, unknown>[] }>(
      endpoints,
      `/cosmos/gov/v1/proposals?${query}`
    );
    return (data.proposals || []).map(normalizeProposal);
  } catch (v1Error) {
    console.warn('gov v1 proposals failed, trying v1beta1:', v1Error);
    const data = await fetchWithFailover<{ proposals?: Record<string, unknown>[] }>(
      endpoints,
      `/cosmos/gov/v1beta1/proposals?${query}`
    );
    return (data.proposals || []).map(normalizeProposal);
  }
}

/** Live tally for a proposal still in voting (final_tally_result is often empty until end). */
export async function fetchProposalTally(
  restEndpoints: string | string[],
  proposalId: string
): Promise<ProposalTally> {
  if (isDemoSession()) {
    const demo = demoGovernanceProposals().find((p) => p.id === proposalId);
    return demo?.tally ?? emptyTally();
  }

  const endpoints = normalizeEndpoints(restEndpoints);
  try {
    const data = await fetchWithFailover<{ tally?: Record<string, string> }>(
      endpoints,
      `/cosmos/gov/v1/proposals/${proposalId}/tally`
    );
    return parseTally(data.tally);
  } catch {
    try {
      const data = await fetchWithFailover<{ tally?: Record<string, string> }>(
        endpoints,
        `/cosmos/gov/v1beta1/proposals/${proposalId}/tally`
      );
      return parseTally(data.tally);
    } catch {
      return emptyTally();
    }
  }
}

/** Returns the voter's existing choice, or null if they have not voted. */
export async function fetchMyVote(
  restEndpoints: string | string[],
  proposalId: string,
  voter: string
): Promise<VoteOptionValue | null> {
  if (!voter || isDemoSession()) return null;

  const endpoints = normalizeEndpoints(restEndpoints);
  try {
    const data = await fetchWithFailover<{
      vote?: { options?: Array<{ option: string | number }>; option?: string | number };
    }>(endpoints, `/cosmos/gov/v1/proposals/${proposalId}/votes/${voter}`);

    const vote = data.vote;
    if (!vote) return null;

    const rawOption = vote.options?.[0]?.option ?? vote.option;
    return parseVoteOption(rawOption);
  } catch {
    // 404 = not voted
    return null;
  }
}

export function parseVoteOption(raw: string | number | undefined | null): VoteOptionValue | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    if (raw >= 1 && raw <= 4) return raw as VoteOptionValue;
    return null;
  }
  const upper = String(raw).toUpperCase();
  if (upper.includes('YES') && !upper.includes('VETO')) return VoteOption.YES;
  if (upper.includes('ABSTAIN')) return VoteOption.ABSTAIN;
  if (upper.includes('VETO')) return VoteOption.NO_WITH_VETO;
  if (upper.includes('NO')) return VoteOption.NO;
  const asNum = Number(raw);
  if (asNum >= 1 && asNum <= 4) return asNum as VoteOptionValue;
  return null;
}
