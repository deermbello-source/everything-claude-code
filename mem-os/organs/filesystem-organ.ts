// FileSystemOrgan — first registered organ.
// Handles file intents. Bound to /mem-body/workspace via filesystemService.
// Pre-promoted (built-in trusted organ, not quarantined on load).

import { Organ }       from '../interfaces/organ';
import { Intent }      from '../agent/intake';
import { MEMState, Fact, Step } from '../agent/state';
import { filesystemService }   from '../services/filesystem';

export const filesystemOrgan: Organ = {
  name:                'filesystem',
  description:         'Read/write files in /mem-body/workspace. Boundary-enforced.',
  requires_human_auth: false,

  handles: (intent: Intent) =>
    ['remember', 'build', 'resolve', 'calculate', 'search'].includes(intent.action),

  dof_cost:  (_intent) => 1,
  inv_gain:  (_result) => 1,

  execute: async (step: Step, state: MEMState): Promise<MEMState> => {
    const params  = step.params as Record<string, unknown>;
    const raw     = (params.raw as string | undefined) ?? '';

    // Extract filename and content from the raw intent if present
    const filename = extract_filename(raw) ?? `${step.action}-${Date.now()}.txt`;
    const content  = extract_content(raw)  ?? '';

    const result = await filesystemService.call('write', {
      path:    filename,
      content: content || JSON.stringify({ intent: raw, step: step.action }, null, 2),
    });

    const fact: Fact = {
      id:         `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content:    result,
      source:     'filesystem',
      timestamp:  Date.now(),
      receipt_id: '',
    };

    // Organs receive the current state. The runner owns step tracking.
    // Return superposition: intent resolved, no open steps, fact committed.
    return {
      ...state,
      active_intent: null,
      open_steps:    [],
      facts:         [...state.facts, fact],
    };
  },
};

// Extract a filename from a natural language intent.
// "create a note called test.txt" → "test.txt"
// "make readme.md" → "readme.md"
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
