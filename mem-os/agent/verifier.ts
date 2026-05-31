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
  if (!minmax_law(F, before, after)) {
    return {
      valid:  false,
      stable: false,
      reason: `Canon violation: dof ${F.dof(before)}→${F.dof(after)}, inv_mass ${F.inv_mass(before)}→${F.inv_mass(after)}`,
    };
  }

  return {
    valid:  true,
    stable: permutation_stable(F, before, after),
  };
}
