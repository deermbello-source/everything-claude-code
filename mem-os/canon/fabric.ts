// TypeScript mirror of Canon.lean (axiom-free kernel).
//
// Convergence proof strategy (from Canon.lean):
//   structural_measure takes values in a FINITE set (ℕ×ℕ bounded by dof_bound×inv_bound).
//   Under minmax_law the sequence (dof, inv_mass) is monotone in both dimensions.
//   By finite pigeonhole it must eventually reach a fixed point — PermutationStable.
//   Ω stability follows as a corollary. No axioms required.

export interface Fabric<S> {
  dof:       (s: S) => number;
  inv_mass:  (s: S) => number;
  // Proof obligations (Canon.lean: dof_le, inv_le).
  // verifier.ts enforces these at runtime.
  dof_bound: number;
  inv_bound: number;
}

// Core law: every admissible transition must decrease dof and increase inv_mass
export function minmax_law<S>(F: Fabric<S>, before: S, after: S): boolean {
  return F.dof(after) <= F.dof(before) &&
         F.inv_mass(after) >= F.inv_mass(before);
}

// Governance pressure — drives toward zero as system converges.
// Ω_structural in Canon.lean: α·dof − β·inv_mass
export function omega<S>(F: Fabric<S>, alpha: number, beta: number, s: S): number {
  return alpha * F.dof(s) - beta * F.inv_mass(s);
}

// True when (dof, inv_mass) has stopped changing — the convergence target.
// Canon.lean: StructurallyEquivalent / PermutationStable
export function permutation_stable<S>(F: Fabric<S>, before: S, after: S): boolean {
  return F.dof(before) === F.dof(after) &&
         F.inv_mass(before) === F.inv_mass(after);
}

// The structural measure — finite pair that the pigeonhole argument acts on.
// Canon.lean: structural_measure
export function structural_measure<S>(F: Fabric<S>, s: S): [number, number] {
  return [F.dof(s), F.inv_mass(s)];
}

// Minimum inv_mass for the system to be addressable.
// Canon.lean: minimal_invariant_mass := 3
export const MINIMAL_INVARIANT_MASS = 3;

// True when the system has enough committed knowledge to remain addressable.
// Canon.lean: AddressabilityIntegrity
export function addressability_integrity<S>(F: Fabric<S>, s: S): boolean {
  return F.inv_mass(s) >= MINIMAL_INVARIANT_MASS;
}

// inv_mass as fraction of capacity — displayed as canonicality %
export function canonicality<S>(F: Fabric<S>, s: S): number {
  if (F.inv_bound === 0) return 0;
  return F.inv_mass(s) / F.inv_bound;
}

// dof as fraction of capacity — displayed as drift %
export function drift_level<S>(F: Fabric<S>, s: S): number {
  if (F.dof_bound === 0) return 0;
  return F.dof(s) / F.dof_bound;
}
