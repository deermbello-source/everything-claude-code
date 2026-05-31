// Agent verifier — checks that a result is valid before committing.
// Runs after execution, before the receipt is written.
// Rejects any result that would violate Canon.

import { Fabric, minmax_law, permutation_stable } from '../canon/fabric';
import { MEMState } from './state';

export interface VerifyResult {
  valid:    boolean;
  stable:   boolean;
  reason?:  string;
}

export function verify(
  F:      Fabric<MEMState>,
  before: MEMState,
  after:  MEMState,
): VerifyResult {
  // Canon.lean proof obligation: dof_le and inv_le must hold for every state.
  // Without this the finite-pigeonhole convergence proof breaks.
  if (F.dof(after) > F.dof_bound) {
    return { valid: false, stable: false, reason: `dof ${F.dof(after)} exceeds bound ${F.dof_bound}` };
  }
  if (F.inv_mass(after) > F.inv_bound) {
    return { valid: false, stable: false, reason: `inv_mass ${F.inv_mass(after)} exceeds bound ${F.inv_bound}` };
  }

  if (!minmax_law(F, before, after)) {
    return {
      valid:  false,
      stable: false,
      reason: `minmax_law: dof ${F.dof(before)}→${F.dof(after)}, inv_mass ${F.inv_mass(before)}→${F.inv_mass(after)}`,
    };
  }

  return {
    valid:  true,
    stable: permutation_stable(F, before, after),
  };
}
