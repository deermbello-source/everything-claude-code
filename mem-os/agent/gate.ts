// Agent gate — post-execution Canon enforcement.
// Checks admissibility of the resulting state transition.
// Human authorization is handled pre-execution in the runner.
// HumanPrimacy violation (self-authorize) is checked here as a permanent backstop.

import { Fabric, minmax_law } from '../canon/fabric';
import { is_human_primacy_violation } from '../canon/auth';
import { MEMState } from './state';

export type GateResult =
  | { ok: true;  auth: 'canon' }
  | { ok: false; reason: 'human_primacy_violation'; action: string }
  | { ok: false; reason: 'inadmissible';            dof_delta: number; inv_mass_delta: number };

export function gate(
  F:      Fabric<MEMState>,
  before: MEMState,
  after:  MEMState,
  action: string,
): GateResult {
  // Permanently inadmissible — the system can never authorize itself
  if (is_human_primacy_violation(action)) {
    return { ok: false, reason: 'human_primacy_violation', action };
  }

  // Canon law — every transition must satisfy minmax_law
  if (!minmax_law(F, before, after)) {
    return {
      ok:             false,
      reason:         'inadmissible',
      dof_delta:      F.dof(after)      - F.dof(before),
      inv_mass_delta: F.inv_mass(after) - F.inv_mass(before),
    };
  }

  return { ok: true, auth: 'canon' };
}
