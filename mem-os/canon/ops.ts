// Governed semantic operations and traversal directions.
// Every intent is classified here before anything executes.
// Classification is not optional — it is what makes intent governable.
//
// Invariant: traversal type must be declared before transformation.
// Invariant: semantic operations are governed transformations, not free outputs.

// ──────────────────────────────────────────────
// Semantic Operation Types
// What the transformation does to the structure.
// ──────────────────────────────────────────────

export type SemanticOp =
  | 'PRESERVE'   // meaning expands while preserving original identity
  | 'BRANCH'     // meaning diverges only if lawful continuity remains
  | 'COLLAPSE'   // distributed ambiguity resolves into stable interpretation
  | 'REFLECT'    // structure returns without distortion — read, not write
  | 'TRANSMIT'   // stabilized structure propagates into next cycle — write, commit
  | 'DISSOLVE';  // unstable state releases without propagation — blocked until bounded

// ──────────────────────────────────────────────
// Traversal Directions
// Which direction the transformation moves through the system.
// ──────────────────────────────────────────────

export type TraversalDir =
  | 'reverse'        // ↰  trace origin, lineage, rollback, causal ancestry
  | 'abstraction'    // ↱  compress upward: generalize, synthesize, pattern-extract
  | 'reflective'     // ↲  inspect inward: self-check, introspect, drift-detect
  | 'propagation'    // ↳  transmit outward: deploy, publish, external effect
  | 'instantiation'  // ↴  concretize downward: build, execute, materialize
  | 'forward';       // →  default: progressive movement through the pipeline

export const TRAVERSAL_SYMBOL: Record<TraversalDir, string> = {
  reverse:       '↰',
  abstraction:   '↱',
  reflective:    '↲',
  propagation:   '↳',
  instantiation: '↴',
  forward:       '→',
};

// ──────────────────────────────────────────────
// Governance Pipeline Stages
// Every admissible transition must pass all eight in order.
// ──────────────────────────────────────────────

export type GovStage =
  | 'proposal'
  | 'registry_match'
  | 'state_derivation'
  | 'predicate_evaluation'
  | 'decision'
  | 'execution_contract'
  | 'verification'
  | 'return';

export const GOV_PIPELINE: GovStage[] = [
  'proposal',
  'registry_match',
  'state_derivation',
  'predicate_evaluation',
  'decision',
  'execution_contract',
  'verification',
  'return',
];

// ──────────────────────────────────────────────
// Classification
// Applied at intake time — before any organ is selected.
// ──────────────────────────────────────────────

export function classify_semantic_op(raw: string): SemanticOp {
  const s = raw.toLowerCase();
  // DISSOLVE first — explicit destructive intent
  if (/\b(delete|remove|clean|discard|drop|destroy|wipe)\b/.test(s))   return 'DISSOLVE';
  // REFLECT — reading, inspecting, reporting
  if (/\b(read|show|list|check|status|inspect|review|find|search|look|what|drift|verify)\b/.test(s)) return 'REFLECT';
  // TRANSMIT — writing, saving, committing, propagating
  if (/\b(save|store|record|remember|write|commit|send|publish|transmit)\b/.test(s)) return 'TRANSMIT';
  // COLLAPSE — resolving ambiguity, deciding, converging
  if (/\b(resolve|decide|clarify|align|converge|collapse|finalize)\b/.test(s)) return 'COLLAPSE';
  // BRANCH — forking, alternating, expanding
  if (/\b(branch|fork|split|alternative|expand|diverge)\b/.test(s))    return 'BRANCH';
  // PRESERVE — building, creating, continuing, extending
  if (/\b(build|create|make|generate|extend|continue|maintain|keep)\b/.test(s)) return 'PRESERVE';
  return 'PRESERVE'; // safe default: preserve structure
}

export function classify_traversal(raw: string): TraversalDir {
  const s = raw.toLowerCase();
  // reverse — tracing back, rollback, origin
  if (/\b(trace|rollback|undo|revert|origin|history|why|source|back|ancestry)\b/.test(s)) return 'reverse';
  // abstraction — generalize, synthesize
  if (/\b(abstract|generalize|pattern|higher|synthesize|summar|overall|across)\b/.test(s)) return 'abstraction';
  // reflective — inspect inward, status, self-check
  if (/\b(reflect|introspect|status|drift|check|inside|self|what is|show me|current)\b/.test(s)) return 'reflective';
  // propagation — transmit outward, deploy
  if (/\b(send|deploy|publish|output|propagate|external|release|broadcast)\b/.test(s)) return 'propagation';
  // instantiation — create, build, materialize
  if (/\b(build|create|make|generate|instantiate|run|execute|start|write)\b/.test(s)) return 'instantiation';
  return 'forward';
}
