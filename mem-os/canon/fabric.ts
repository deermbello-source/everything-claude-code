// TypeScript mirror of Canon.lean
// The law. Never changes.

export interface Fabric<S> {
  dof:       (s: S) => number;
  inv_mass:  (s: S) => number;
  dof_bound: number;
  inv_bound: number;
}

// Core law: every admissible transition must decrease dof and increase inv_mass
export function minmax_law<S>(F: Fabric<S>, before: S, after: S): boolean {
  return F.dof(after) <= F.dof(before) &&
         F.inv_mass(after) >= F.inv_mass(before);
}

// Governance pressure — drives toward zero as system converges
export function omega<S>(F: Fabric<S>, alpha: number, beta: number, s: S): number {
  return alpha * F.dof(s) - beta * F.inv_mass(s);
}

// True when (dof, inv_mass) has stopped changing — the convergence target
export function permutation_stable<S>(F: Fabric<S>, before: S, after: S): boolean {
  return F.dof(before) === F.dof(after) &&
         F.inv_mass(before) === F.inv_mass(after);
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
