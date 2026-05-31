// TraversalRegistry — session-scoped ledger of traversal directions.
//
// Enforces the down-down forbidden rule:
//   instantiation↴ or propagation↳ followed immediately by another downward traversal
//   is blocked. An upward (reverse↰, abstraction↱) or lateral (reflective↲, forward→)
//   step must intervene before the next downward move is permitted.
//
// Why: consecutive downward traversals instantiate contaminated state without verification.
// The output of the first unverified descent becomes the input of the second.

import { TraversalDir } from './ops';

export type TraversalPolarity = 'down' | 'up' | 'lateral';

export function traversal_polarity(dir: TraversalDir): TraversalPolarity {
  if (dir === 'instantiation' || dir === 'propagation') return 'down';
  if (dir === 'reverse'       || dir === 'abstraction') return 'up';
  return 'lateral';   // reflective, forward
}

export interface TraversalEntry {
  traversal:  TraversalDir;
  polarity:   TraversalPolarity;
  step_id:    string;
  timestamp:  number;
}

export interface TraversalCheckResult {
  ok:      boolean;
  reason?: string;
}

export interface TraversalRegistry {
  check:      (traversal: TraversalDir) => TraversalCheckResult;
  record:     (traversal: TraversalDir, step_id: string) => void;
  last_entry: () => TraversalEntry | null;
  entries:    () => TraversalEntry[];
  down_count: () => number;
  up_count:   () => number;
}

export function make_traversal_registry(): TraversalRegistry {
  const log: TraversalEntry[] = [];

  function last_entry(): TraversalEntry | null {
    return log.length > 0 ? log[log.length - 1] : null;
  }

  return {
    check(traversal): TraversalCheckResult {
      const prev = last_entry();
      if (!prev) return { ok: true };
      if (traversal_polarity(prev.traversal) === 'down' && traversal_polarity(traversal) === 'down') {
        return {
          ok:     false,
          reason: `down-down forbidden: ${prev.traversal}↴ → ${traversal}↴  ` +
                  `Insert reflective↲, abstraction↱, or reverse↰ before the next downward step.`,
        };
      }
      return { ok: true };
    },

    record(traversal, step_id) {
      log.push({ traversal, polarity: traversal_polarity(traversal), step_id, timestamp: Date.now() });
    },

    last_entry,
    entries:    () => [...log],
    down_count: () => log.filter(e => e.polarity === 'down').length,
    up_count:   () => log.filter(e => e.polarity === 'up').length,
  };
}
