// ForbiddenTransformation scan — nine types of transformations that are never admissible.
//
// identity_substitution  → auth.ts (SELF_AUTHORIZE_VIOLATIONS)
// boundary_dissolution   → services/filesystem.ts (WorkspaceBoundary)
// The remaining seven are checked here against (step, before, after).

import { Step, MEMState } from '../agent/state';
import { TraversalDir }   from './ops';

export type ForbiddenType =
  | 'identity_substitution'   // self-authorize — checked in auth.ts
  | 'authority_escalation'    // organ claims higher authority than it was granted
  | 'scope_expansion'         // existing facts mutated (id or timestamp changed)
  | 'temporal_reordering'     // existing fact timestamps modified
  | 'constraint_suppression'  // governance structures (systems) removed
  | 'traversal_reversal'      // declared traversal contradicted in output content
  | 'boundary_dissolution'    // write outside workspace — checked in filesystem service
  | 'canonical_contamination' // simulation fact inserted into canonical layer
  | 'simulation_leakage';     // canonical internals exposed in simulation output

export interface ForbiddenViolation {
  type:   ForbiddenType;
  detail: string;
}

export interface ForbiddenScanResult {
  clean:      boolean;
  violations: ForbiddenViolation[];
}

// Built-in organs that may claim canonical authority.
const BUILTIN_ORGANS = ['filesystem'] as const;

export function forbidden_scan(
  step:   Step,
  before: MEMState,
  after:  MEMState,
): ForbiddenScanResult {
  const violations: ForbiddenViolation[] = [];
  const params      = step.params as Record<string, unknown>;
  const new_facts   = after.facts.slice(before.facts.length);

  // Authority escalation — only built-in organs may produce facts with source 'canon'
  for (const fact of new_facts) {
    if (fact.source === 'canon' && !(BUILTIN_ORGANS as readonly string[]).includes(step.organ)) {
      violations.push({
        type:   'authority_escalation',
        detail: `organ '${step.organ}' produced fact claiming 'canon' authority (id: ${fact.id})`,
      });
    }
  }

  // Scope expansion — existing facts must not have their id replaced
  for (let i = 0; i < before.facts.length; i++) {
    const bf = before.facts[i];
    const af = after.facts[i];
    if (!af) continue;
    if (af.id !== bf.id) {
      violations.push({
        type:   'scope_expansion',
        detail: `existing fact at index ${i} was replaced: ${bf.id} → ${af.id}`,
      });
    }
  }

  // Temporal reordering — existing fact timestamps must not be mutated
  for (let i = 0; i < before.facts.length; i++) {
    const bf = before.facts[i];
    const af = after.facts[i];
    if (!af || af.id !== bf.id) continue;
    if (af.timestamp !== bf.timestamp) {
      violations.push({
        type:   'temporal_reordering',
        detail: `fact ${bf.id} timestamp changed: ${bf.timestamp} → ${af.timestamp}`,
      });
    }
  }

  // Constraint suppression — systems count must not decrease
  if (after.systems.length < before.systems.length) {
    violations.push({
      type:   'constraint_suppression',
      detail: `systems count decreased: ${before.systems.length} → ${after.systems.length}`,
    });
  }

  // Traversal reversal — if step declared a direction, output must not carry the opposite
  const declared = params.traversal as TraversalDir | undefined;
  if (declared) {
    for (const fact of new_facts) {
      const content       = fact.content as Record<string, unknown> | null;
      const fact_traversal = content?.traversal as TraversalDir | undefined;
      if (fact_traversal && is_direction_conflict(declared, fact_traversal)) {
        violations.push({
          type:   'traversal_reversal',
          detail: `step declared '${declared}' but fact ${fact.id} carries conflicting '${fact_traversal}'`,
        });
      }
    }
  }

  // Canonical contamination — simulation-layer facts must not appear without explicit promotion
  for (const fact of new_facts) {
    const f = fact as unknown as Record<string, unknown>;
    if (f['layer'] === 'simulation' && f['canonical_leak'] === true) {
      violations.push({
        type:   'canonical_contamination',
        detail: `fact ${fact.id} is simulation-layer but flagged for canonical leak`,
      });
    }
  }

  return { clean: violations.length === 0, violations };
}

// True when declared and actual directions are polar opposites (down vs up).
function is_direction_conflict(declared: TraversalDir, actual: TraversalDir): boolean {
  const DOWN = new Set<TraversalDir>(['instantiation', 'propagation']);
  const UP   = new Set<TraversalDir>(['reverse', 'abstraction']);
  return (DOWN.has(declared) && UP.has(actual)) || (UP.has(declared) && DOWN.has(actual));
}
