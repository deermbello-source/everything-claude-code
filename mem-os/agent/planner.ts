// Agent planner — converts intent into steps.
// Validates the intent as a Proposal before any organ selection.
// A rejected Proposal returns immediately — the organ registry is never queried.
// Uses api.queryRegistry — cannot access the registry directly.

import { RuntimeAPI }                         from '../runtime/api';
import { Intent }                             from './intake';
import { MEMState, Step }                     from './state';
import { make_proposal, proposal_admissible } from './proposal';

export function plan(
  intent:  Intent,
  state:   MEMState,
  api:     RuntimeAPI,
): Step[] {
  // Governance stage 1: proposal validation
  const proposal = make_proposal(intent, state);
  if (!proposal_admissible(proposal)) {
    return [{
      id:                  `step_${Date.now()}`,
      organ:               '__unresolved__',
      action:              `proposal:${proposal.status}`,
      params:              { intent_raw: intent.raw, reason: proposal.reason, status: proposal.status },
      requires_human_auth: false,
    }];
  }

  const capable = api.queryRegistry(intent);

  if (capable.length === 0) {
    return [{
      id:                  `step_${Date.now()}`,
      organ:               '__unresolved__',
      action:              'no_organ_available',
      params:              { intent_raw: intent.raw, intent_action: intent.action, intent_domain: intent.domain },
      requires_human_auth: false,
    }];
  }

  const organ = capable.sort((a, b) => a.dof_cost(intent) - b.dof_cost(intent))[0];

  return [{
    id:                  `step_${Date.now()}`,
    organ:               organ.name,
    action:              intent.action,
    params:              intent.params,
    requires_human_auth: organ.requires_human_auth,
  }];
}
