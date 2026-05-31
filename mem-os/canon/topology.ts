// Topology map — governs which traversal directions are lawful per domain.
// Finance and security may not propagate or instantiate without a human gate.
// Research and data operate in reflective/abstract mode — no direct materialization.
// Unknown domains: all traversals permitted (no constraint applied).

import { TraversalDir } from './ops';

interface TopologyEntry {
  domain:             string;
  allowed_traversals: TraversalDir[];
  constraint_reason:  string;
}

const TOPOLOGY: TopologyEntry[] = [
  {
    domain:             'finance',
    allowed_traversals: ['forward', 'reflective', 'abstraction', 'reverse'],
    constraint_reason:  'Finance may not propagate or instantiate without human gate — no direct external effect',
  },
  {
    domain:             'security',
    allowed_traversals: ['forward', 'reflective', 'abstraction', 'reverse'],
    constraint_reason:  'Security may not propagate or instantiate — no direct external effect',
  },
  {
    domain:             'research',
    allowed_traversals: ['forward', 'reflective', 'abstraction', 'reverse'],
    constraint_reason:  'Research operates in reflective/abstract mode — no direct materialization',
  },
  {
    domain:             'data',
    allowed_traversals: ['forward', 'reflective', 'abstraction', 'reverse'],
    constraint_reason:  'Data operates in reflective/abstract mode — no direct external effect',
  },
  {
    domain:             'code',
    allowed_traversals: ['forward', 'instantiation', 'reflective', 'reverse', 'abstraction'],
    constraint_reason:  'Code builds and reflects — no external propagation without human gate',
  },
  {
    domain:             'design',
    allowed_traversals: ['forward', 'abstraction', 'reflective', 'instantiation'],
    constraint_reason:  'Design abstracts and materializes — no direct propagation',
  },
  {
    domain:             'logistics',
    allowed_traversals: ['forward', 'propagation', 'instantiation', 'reflective', 'reverse'],
    constraint_reason:  'Logistics may materialize and propagate — it is the execution domain',
  },
  {
    domain:             'infrastructure',
    allowed_traversals: ['forward', 'propagation', 'instantiation', 'reflective', 'reverse'],
    constraint_reason:  'Infrastructure operates at execution level and may propagate',
  },
];

export function is_traversal_lawful(domain: string, traversal: TraversalDir): boolean {
  const entry = TOPOLOGY.find(t => t.domain === domain);
  if (!entry) return true;
  return entry.allowed_traversals.includes(traversal);
}

export function traversal_constraint_reason(domain: string, traversal: TraversalDir): string | null {
  const entry = TOPOLOGY.find(t => t.domain === domain);
  if (!entry || entry.allowed_traversals.includes(traversal)) return null;
  return entry.constraint_reason;
}
