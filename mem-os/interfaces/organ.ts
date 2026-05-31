// Organ interface — the contract any capability must satisfy.
// The system never hardcodes a list of organs.
// It queries this registry at planning time.

import { Intent } from '../agent/intake';
import { MEMState, Step } from '../agent/state';

export interface Organ {
  name:                string;
  description:         string;
  requires_human_auth: boolean;
  handles:   (intent: Intent) => boolean;
  dof_cost:  (intent: Intent) => number;
  inv_gain:  (result: unknown) => number;
  execute:   (step: Step, state: MEMState) => Promise<MEMState>;
}

export interface OrganRegistry {
  register:   (organ: Organ) => void;
  unregister: (name: string) => void;
  get:        (name: string) => Organ | undefined;
  list:       () => Organ[];
}

export function makeRegistry(): OrganRegistry {
  const organs = new Map<string, Organ>();
  return {
    register:   (o) => { organs.set(o.name, o); },
    unregister: (name) => { organs.delete(name); },
    get:        (name) => organs.get(name),
    list:       () => Array.from(organs.values()),
  };
}
