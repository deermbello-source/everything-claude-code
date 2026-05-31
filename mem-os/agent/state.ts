// MEMState — what the agent holds and what memory persists.
// Shared between agent and memory layer.

export interface Fact {
  id:          string;
  content:     unknown;
  source:      string;
  timestamp:   number;
  receipt_id?: string;   // linked after receipt is written; not available at organ execution time
}

export interface Step {
  id:                  string;
  organ:               string;
  action:              string;
  params:              unknown;
  requires_human_auth: boolean;
}

export interface SystemDef {
  id:         string;
  name:       string;
  domain:     string;
  created_at: number;
  receipt_id: string;
}

export interface MEMState {
  session_id:    string;
  active_intent: string | null;   // null = superposition
  open_steps:    Step[];          // pending work
  facts:         Fact[];          // committed knowledge
  systems:       SystemDef[];     // governed sub-systems built so far
}

// dof: open choices — 0 in superposition, rises with active work
export function dof(s: MEMState): number {
  return (s.active_intent !== null ? 1 : 0) + s.open_steps.length;
}

// inv_mass: committed knowledge — only grows, never shrinks
export function inv_mass(s: MEMState): number {
  return s.facts.length + s.systems.length;
}

export const DOF_BOUND = 1000;
export const INV_BOUND = 100_000;

export function superposition(
  session_id: string,
  facts:      Fact[],
  systems:    SystemDef[],
): MEMState {
  return { session_id, active_intent: null, open_steps: [], facts, systems };
}

export function with_intent(s: MEMState, intent: string, steps: Step[]): MEMState {
  return { ...s, active_intent: intent, open_steps: steps };
}

export function resolve_step(s: MEMState, step_id: string, new_fact?: Fact): MEMState {
  const open_steps    = s.open_steps.filter(st => st.id !== step_id);
  const facts         = new_fact ? [...s.facts, new_fact] : s.facts;
  const active_intent = open_steps.length === 0 ? null : s.active_intent;
  return { ...s, open_steps, facts, active_intent };
}
