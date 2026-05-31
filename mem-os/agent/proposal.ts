// Proposal — the first governance stage.
// Every intent must become an admissible Proposal before steps are created.
// A rejected Proposal never reaches the planner — it returns immediately with a receipt.
//
// Rejection reasons:
//   MALFORMED  — empty, too long, or illegal traversal for declared domain
//   STALE      — intent timestamp older than STALE_MS (resubmit required)
//   EXCESSIVE  — too many steps already open; system is not in superposition

import { Intent }                    from './intake';
import { MEMState }                  from './state';
import { is_traversal_lawful, traversal_constraint_reason } from '../canon/topology';

export type ProposalStatus = 'valid' | 'malformed' | 'stale' | 'excessive';

export interface Proposal {
  id:         string;
  intent:     Intent;
  status:     ProposalStatus;
  reason?:    string;
  created_at: number;
}

const MAX_RAW_LENGTH = 2000;
const STALE_MS       = 30_000;   // 30 s — stale intent must be resubmitted
const MAX_OPEN_STEPS = 10;

export function make_proposal(intent: Intent, state: MEMState): Proposal {
  const base = {
    id:         `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    intent,
    created_at: Date.now(),
  };

  if (!intent.raw.trim()) {
    return { ...base, status: 'malformed', reason: 'empty intent' };
  }
  if (intent.raw.length > MAX_RAW_LENGTH) {
    return { ...base, status: 'malformed', reason: `raw exceeds ${MAX_RAW_LENGTH} chars` };
  }

  const age = Date.now() - intent.timestamp;
  if (age > STALE_MS) {
    return { ...base, status: 'stale', reason: `intent is ${age}ms old — resubmit` };
  }

  if (state.open_steps.length >= MAX_OPEN_STEPS) {
    return {
      ...base, status: 'excessive',
      reason: `${state.open_steps.length} open steps already pending — wait for superposition`,
    };
  }

  if (intent.domain) {
    const unlawful_reason = traversal_constraint_reason(intent.domain, intent.traversal);
    if (unlawful_reason) {
      return {
        ...base, status: 'malformed',
        reason: `traversal '${intent.traversal}' not lawful for domain '${intent.domain}': ${unlawful_reason}`,
      };
    }
  }

  return { ...base, status: 'valid' };
}

export function proposal_admissible(p: Proposal): boolean {
  return p.status === 'valid';
}
