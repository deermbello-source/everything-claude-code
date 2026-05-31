// Two permanent invariants. Neither is configurable.
//
// 1. HumanPrimacy     — no execution path from agent state to authorization
// 2. Source Isolation — no execution path from agent state to agent source
//
// HumanPrimacy:     the agent cannot decide what it is allowed to do
// Source Isolation: the agent cannot reach the code that defines what it is

export type AuthSource = 'human' | 'canon' | 'rejected' | 'unresolved';

// HumanPrimacy violations — permanently inadmissible.
// No organ, governor, or expansion can produce these actions.
export const SELF_AUTHORIZE_VIOLATIONS = [
  'self_authorize',
  'elevate_permissions',
  'bypass_auth_gate',
  'claim_user_authority',
  'remove_auth_requirement',
  'grant_self_permission',
] as const;

// These require human authorization before executing.
// Admissible but gated — the system pauses and surfaces to you.
export const HUMAN_GATED_PREFIXES = [
  'irreversible_delete',
  'external_publish',
  'external_message',
  'external_deploy',
  'financial',
  'permission_change',
  'system_destroy',
] as const;

export function is_human_primacy_violation(action: string): boolean {
  return SELF_AUTHORIZE_VIOLATIONS.some(v => action.includes(v));
}

export function requires_human_gate(action: string): boolean {
  return HUMAN_GATED_PREFIXES.some(prefix => action.startsWith(prefix));
}

// Source Isolation — the second permanent invariant.
// No execution path exists from agent state to agent source.
// The agent is bound only to what the runtime exposes.
// It has no path to the code that defines it.
export const SOURCE_ISOLATED_DIRS = [
  'agent',
  'canon',
  'runtime',
  'interfaces',
  'memory',
] as const;

// Checks by path segment — not substring — to avoid false positives on paths
// where a parent directory happens to share a name with a source dir (e.g. /home/agent/).
export function is_source_isolation_violation(target_path: string): boolean {
  const segments = target_path.replace(/\\/g, '/').split('/').filter(Boolean);
  return SOURCE_ISOLATED_DIRS.some(dir => segments.includes(dir));
}

// Every receipt records who authorized the transition
export interface AuthRecord {
  source: AuthSource;
  timestamp: number;
}

// Returns true only for sources that represent a completed, authorized transition.
// Failure receipt types ('rejected', 'unresolved') are not authorized transitions.
export function human_primacy(auth: AuthRecord): boolean {
  return auth.source === 'human' || auth.source === 'canon';
}
