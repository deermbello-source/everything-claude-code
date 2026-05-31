// Organ Assimilation Topology — onboarding path for all new organs.
//
// Stages: Discover → Classify → Constrain → Rename → Wrap → Admit → Verify → Compose
//
//   Quarantine (quarantine.ts) handles:  Constrain, Admit, Compose (registry.register)
//   This module handles:                 Classify, Wrap
//
// Call assimilate() at promotion time — after quarantine clears, before registry.register.
// Built-in organs (filesystem) skip quarantine but still pass through classify + wrap.

import { Organ }        from '../interfaces/organ';
import { Intent }       from '../agent/intake';
import { MEMState, Step } from '../agent/state';
import { TraversalDir } from '../canon/ops';

export interface OrganMetadata {
  name:                string;
  declared_actions:    string[];
  declared_traversals: TraversalDir[];
  classified_at:       number;
}

const PROBE_ACTIONS: string[] = [
  'remember', 'build', 'resolve', 'calculate', 'search', 'report', 'heal', 'expand', 'find',
];

const ALL_TRAVERSALS: TraversalDir[] = [
  'forward', 'reverse', 'abstraction', 'reflective', 'propagation', 'instantiation',
];

// Classify — probe the organ's handles() predicate to extract what it declares.
// No execution happens. Only the interface is inspected.
export function classify_organ(organ: Organ): OrganMetadata {
  const make_probe = (action: string, traversal: TraversalDir): Intent => ({
    id:          'probe',
    raw:         action,
    action,
    domain:      null,
    semantic_op: 'PRESERVE',
    traversal,
    params:      {},
    timestamp:   Date.now(),
  });

  const declared_actions = PROBE_ACTIONS.filter(
    action => organ.handles(make_probe(action, 'forward')),
  );

  const declared_traversals = ALL_TRAVERSALS.filter(
    traversal => organ.handles(make_probe('resolve', traversal)),
  );

  return {
    name:                organ.name,
    declared_actions,
    declared_traversals,
    classified_at:       Date.now(),
  };
}

// Wrap — place a governed surface around the organ.
// Blocks execution of any action or traversal direction not declared at classification.
// The outer surface is transparent — handles, dof_cost, inv_gain are unmodified.
export function wrap_organ(organ: Organ, metadata: OrganMetadata): Organ {
  return {
    name:                organ.name,
    description:         organ.description,
    requires_human_auth: organ.requires_human_auth,
    handles:             organ.handles.bind(organ),
    dof_cost:            organ.dof_cost.bind(organ),
    inv_gain:            organ.inv_gain.bind(organ),

    execute: async (step: Step, state: MEMState): Promise<MEMState> => {
      const params    = step.params as Record<string, unknown>;
      const traversal = params.traversal as TraversalDir | undefined;

      if (traversal && metadata.declared_traversals.length > 0 &&
          !metadata.declared_traversals.includes(traversal)) {
        throw new Error(
          `Organ '${organ.name}': traversal '${traversal}' not declared. ` +
          `Declared: [${metadata.declared_traversals.join(', ')}]`,
        );
      }

      if (metadata.declared_actions.length > 0 &&
          !metadata.declared_actions.includes(step.action)) {
        throw new Error(
          `Organ '${organ.name}': action '${step.action}' not declared. ` +
          `Declared: [${metadata.declared_actions.join(', ')}]`,
        );
      }

      return organ.execute(step, state);
    },
  };
}

// Assimilate — classify then wrap in one call.
// Returns both the governed organ and its metadata.
export function assimilate(organ: Organ): { organ: Organ; metadata: OrganMetadata } {
  const metadata = classify_organ(organ);
  return { organ: wrap_organ(organ, metadata), metadata };
}
