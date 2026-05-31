// Agent intake — receives intent from any source, normalizes it.
// Every intent is classified for semantic operation and traversal direction
// before it reaches the planner. Classification precedes all execution.

import { SemanticOp, TraversalDir, classify_semantic_op, classify_traversal } from '../canon/ops';

export type { SemanticOp, TraversalDir };

export interface Intent {
  id:           string;
  raw:          string;
  action:       string;
  domain:       string | null;
  semantic_op:  SemanticOp;    // what the transformation does to structure
  traversal:    TraversalDir;  // which direction to move through the system
  params:       Record<string, unknown>;
  timestamp:    number;
}

export function intake(raw: string): Intent {
  const trimmed    = raw.trim();
  const semantic_op = classify_semantic_op(trimmed);
  const traversal   = classify_traversal(trimmed);
  return {
    id:          `intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    raw:         trimmed,
    action:      parse_action(trimmed),
    domain:      parse_domain(trimmed),
    semantic_op,
    traversal,
    params:      { raw: trimmed, semantic_op, traversal },
    timestamp:   Date.now(),
  };
}

function parse_action(raw: string): string {
  const lower = raw.toLowerCase();
  if (/calculat|comput|math|formula/.test(lower))       return 'calculate';
  if (/build|creat|make|scaffold|generate/.test(lower)) return 'build';
  if (/find|search|look|query|fetch/.test(lower))       return 'search';
  if (/remember|store|save|record/.test(lower))         return 'remember';
  if (/heal|fix|repair|restore/.test(lower))            return 'heal';
  if (/expand|add|load|install/.test(lower))            return 'expand';
  if (/show|status|report|what/.test(lower))            return 'report';
  return 'resolve';
}

function parse_domain(raw: string): string | null {
  const lower   = raw.toLowerCase();
  const domains = [
    'finance', 'logistics', 'code', 'research',
    'design', 'data', 'security', 'infrastructure',
  ];
  return domains.find(d => lower.includes(d)) ?? null;
}
