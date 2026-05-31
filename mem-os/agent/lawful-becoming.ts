// LawfulBecoming — post-execution derivation validity.
//
// Canon verification (verifier.ts) checks structural bounds and minmax_law.
// LawfulBecoming checks that the result was lawfully DERIVED from the input.
// These are different claims. A state can satisfy Canon bounds while being
// produced by an unlawful derivation process.
//
// Four checks:
//   identity_mutation    — core identity fields (session_id) must not be mutated by organs
//   scope_exceeded       — a single step may not add an unbounded number of facts
//   misattribution       — new facts must not falsely claim 'canon' as their source
//   intent_redirect      — organs may not redirect active_intent to a different value

import { Step, MEMState } from './state';

export type LawfulBecomingViolationType =
  | 'identity_mutation'   // session_id or identity field mutated by organ
  | 'scope_exceeded'      // too many facts produced in one step
  | 'misattribution'      // fact claims a source authority it does not have
  | 'intent_redirect';    // organ redirected active_intent to a new value

export interface LawfulBecomingViolation {
  type:   LawfulBecomingViolationType;
  detail: string;
}

export interface LawfulBecomingResult {
  lawful:     boolean;
  violations: LawfulBecomingViolation[];
}

const MAX_FACTS_PER_STEP = 20;

export function lawful_becoming(
  step:   Step,
  before: MEMState,
  after:  MEMState,
): LawfulBecomingResult {
  const violations: LawfulBecomingViolation[] = [];

  // Identity preservation — organs cannot mutate the session identity
  if (after.session_id !== before.session_id) {
    violations.push({
      type:   'identity_mutation',
      detail: `session_id mutated by organ '${step.organ}': ${before.session_id} → ${after.session_id}`,
    });
  }

  // Scope — single step cannot flood the fact log
  const new_facts = after.facts.slice(before.facts.length);
  if (new_facts.length > MAX_FACTS_PER_STEP) {
    violations.push({
      type:   'scope_exceeded',
      detail: `organ '${step.organ}' added ${new_facts.length} facts in one step (max ${MAX_FACTS_PER_STEP})`,
    });
  }

  // Misattribution — only built-in organs may claim 'canon' as source
  const BUILTIN_ORGANS = ['filesystem'];
  for (const fact of new_facts) {
    if (fact.source === 'canon' && !BUILTIN_ORGANS.includes(step.organ)) {
      violations.push({
        type:   'misattribution',
        detail: `fact ${fact.id} claims source 'canon' but was produced by organ '${step.organ}'`,
      });
    }
  }

  // Intent redirect — organs may not reassign active_intent to a new value
  if (after.active_intent !== null &&
      before.active_intent !== null &&
      after.active_intent !== before.active_intent) {
    violations.push({
      type:   'intent_redirect',
      detail: `organ '${step.organ}' redirected active_intent: '${before.active_intent}' → '${after.active_intent}'`,
    });
  }

  return { lawful: violations.length === 0, violations };
}
