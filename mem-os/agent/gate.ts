// Agent gate — checks admissibility before any step executes.
// HumanPrimacy first. Canon law second. Nothing bypasses this.

import { Fabric, minmax_law } from '../canon/fabric';
import { is_human_primacy_violation, requires_human_gate } from '../canon/auth';
import { MEMState } from './state';

export type GateResult =
  | { ok: true;  auth: 'canon' }
  | { ok: false; reason: 'human_primacy_violation'; action: string }
  | { ok: false; reason: 'requires_human';          action: string }
  | { ok: false; reason: 'inadmissible';            dof_delta: number; inv_mass_delta: number };

export function gate(
  F:      Fabric<MEMState>,
  before: MEMState,
  after:  MEMState,
  action: string,
): GateResult {
  // Layer 1: permanently inadmissible — the system can never authorize itself
  if (is_human_primacy_violation(action)) {
    return { ok: false, reason: 'human_primacy_violation', action };
  }

  // Layer 2: admissible but gated — pauses until you approve
  if (requires_human_gate(action)) {
    return { ok: false, reason: 'requires_human', action };
  }

  // Layer 3: Canon law — every transition must satisfy minmax_law
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
