// Agent planner — converts intent into steps.
// Uses api.queryRegistry — cannot access the registry directly.
// The runtime decides what organs exist. The agent only sees the result.

import { RuntimeAPI } from '../runtime/api';
import { Intent }     from './intake';
import { MEMState, Step } from './state';

export function plan(
  intent:  Intent,
  state:   MEMState,
  api:     RuntimeAPI,
): Step[] {
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
