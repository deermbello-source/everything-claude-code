// Agent intake — receives intent from any source, normalizes it.
// The agent's front door.

export interface Intent {
  id:        string;
  raw:       string;
  action:    string;
  domain:    string | null;
  params:    Record<string, unknown>;
  timestamp: number;
}

export function intake(raw: string): Intent {
  const trimmed = raw.trim();
  return {
    id:        `intent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    raw:       trimmed,
    action:    parse_action(trimmed),
    domain:    parse_domain(trimmed),
    params:    { raw: trimmed },   // raw passes through for organ-level extraction
    timestamp: Date.now(),
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
