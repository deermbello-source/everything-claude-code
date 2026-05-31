// FileSystemOrgan — first registered organ.
// Handles file intents. Bound to /mem-body/workspace via filesystemService.
// Pre-promoted (built-in trusted organ, not quarantined on load).
// Traversal-aware: semantic_op and traversal direction determine the actual operation.

import { Organ }       from '../interfaces/organ';
import { Intent }      from '../agent/intake';
import { MEMState, Fact, Step } from '../agent/state';
import { filesystemService }   from '../services/filesystem';
import { SemanticOp, TraversalDir } from '../canon/ops';

export const filesystemOrgan: Organ = {
  name:                'filesystem',
  description:         'Read/write files in /mem-body/workspace. Traversal-aware. Boundary-enforced.',
  requires_human_auth: false,

  handles: (intent: Intent) =>
    ['remember', 'build', 'resolve', 'calculate', 'search', 'report'].includes(intent.action),

  dof_cost:  (_intent) => 1,
  inv_gain:  (_result) => 1,

  execute: async (step: Step, state: MEMState): Promise<MEMState> => {
    const params      = step.params as Record<string, unknown>;
    const raw         = (params.raw        as string       | undefined) ?? '';
    const semantic_op = (params.semantic_op as SemanticOp  | undefined) ?? 'PRESERVE';
    const traversal   = (params.traversal   as TraversalDir | undefined) ?? 'forward';

    // Preservation-First: DISSOLVE is blocked until bounded deletion policy exists.
    // Invariant: destructive mutation is blocked by default.
    if (semantic_op === 'DISSOLVE') {
      throw new Error('DISSOLVE blocked: Preservation-First active. Define bounded deletion policy first.');
    }

    // REFLECT or reflective traversal → read, not write.
    // The system inspects structure without altering it.
    if (semantic_op === 'REFLECT' || traversal === 'reflective') {
      const filename = extract_filename(raw);
      let result: unknown;
      if (filename) {
        result = await filesystemService.call('read', { path: filename });
      } else {
        result = await filesystemService.call('list', { path: '.' });
      }
      return state_with_fact(result, semantic_op, traversal, state);
    }

    // reverse traversal → read: tracing origin, not creating new state
    if (traversal === 'reverse') {
      const filename = extract_filename(raw);
      const result   = filename
        ? await filesystemService.call('read', { path: filename })
        : await filesystemService.call('list', { path: '.' });
      return state_with_fact(result, semantic_op, traversal, state);
    }

    // All other ops (TRANSMIT, PRESERVE, COLLAPSE, BRANCH) + (instantiation, propagation, forward)
    // → write: create or update state in the workspace.
    const filename = extract_filename(raw) ?? `${step.action}-${Date.now()}.txt`;
    const content  = extract_content(raw)  ?? '';

    const result = await filesystemService.call('write', {
      path:    filename,
      content: content || JSON.stringify({ intent: raw, semantic_op, traversal, action: step.action }, null, 2),
    });

    return state_with_fact(result, semantic_op, traversal, state);
  },
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function state_with_fact(
  result:     unknown,
  semantic_op: SemanticOp,
  traversal:  TraversalDir,
  state:      MEMState,
): MEMState {
  const fact: Fact = {
    id:        `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    content:   result,
    source:    'filesystem',
    timestamp: Date.now(),
  };
  return {
    ...state,
    active_intent: null,
    open_steps:    [],
    facts:         [...state.facts, fact],
  };
}

// Extract a filename from natural language.
// "create a note called test.txt" → "test.txt"
function extract_filename(raw: string): string | null {
  const patterns = [
    /called\s+([\w.-]+\.[a-z]+)/i,
    /named\s+([\w.-]+\.[a-z]+)/i,
    /file\s+([\w.-]+\.[a-z]+)/i,
    /note\s+([\w.-]+\.[a-z]+)/i,
    /([\w.-]+\.[a-z]{2,4})\b/i,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

// Extract quoted or trailing content from an intent.
// "create note called test.txt with content hello world" → "hello world"
function extract_content(raw: string): string | null {
  const m = raw.match(/(?:with content|content:?|saying|containing)\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}
