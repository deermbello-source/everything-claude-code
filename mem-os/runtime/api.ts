// RuntimeAPI — the agent's complete universe.
// Information flows downward only:
//
//   Authority Layer
//       ↓
//   Runtime Layer   ← constructs and owns this API
//       ↓
//   Agent Layer     ← receives and operates within this API
//       ↓
//   Organs / Services
//
// The agent may know its identity and capabilities.
// The agent may not inspect the implementation that defines those things.
// Nothing above this surface exists from the agent's perspective.

import { MEMState, Step } from '../agent/state';
import { Intent }         from '../agent/intake';
import { Receipt }        from '../memory/receipts';
import { Organ }          from '../interfaces/organ';
import { Fabric }         from '../canon/fabric';

// What the agent knows about itself — operational metadata, not source.
// Enough to make planning decisions. Not enough to reason over implementation.
export interface AgentIdentity {
  name:         string;
  version:      string;
  session_id:   string;
  capabilities: string[];   // names of what the agent can do, not how
}

// The complete, explicit surface the runtime exposes downward.
// Anything not in this interface does not exist for the agent.
export interface RuntimeAPI {
  identity:     AgentIdentity;
  fabric:       Fabric<MEMState>;

  // Memory operations — downward only
  readState:    ()                          => Promise<MEMState>;
  writeReceipt: (receipt: Receipt)          => Promise<void>;
  readReceipts: (n: number)                 => Promise<Receipt[]>;

  // Capability operations — runtime-mediated, cannot bypass gate
  queryRegistry:(intent: Intent)            => Organ[];
  invokeOrgan:  (step: Step, state: MEMState) => Promise<MEMState>;
}
