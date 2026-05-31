// Runtime process — boots the sandbox, constructs the RuntimeAPI, starts the agent.
//
// Stack:
//   Computer → MEM OS → Runtime → Sandbox → MEM Agent
//
// The runtime owns everything above the API surface.
// The agent receives only the API. That surface is its entire universe.
//
// Invariants enforced before the agent starts:
//   HumanPrimacy      — no path from agent state to authorization
//   SourceIsolation   — no path from agent state to agent source
//   WorkspaceBoundary — no file write outside /mem-body/workspace

import path                              from 'path';
import fs                                from 'fs/promises';
import { start_agent }                   from '../agent/loop';
import { RuntimeAPI, AgentIdentity }     from './api';
import { loadState, makeReceiptStore, commitFact, commitSystem } from '../memory/store';
import { makeRegistry }                  from '../interfaces/organ';
import { makeServiceRegistry }           from '../interfaces/service';
import { MEMState, dof, inv_mass, DOF_BOUND, INV_BOUND } from '../agent/state';
import { Fabric }                        from '../canon/fabric';
import { filesystemOrgan }               from '../organs/filesystem-organ';
import { filesystemService }             from '../services/filesystem';

const VERSION    = '0.1.0';
const SESSION_ID = `session_${Date.now()}`;
const BODY_ROOT  = process.env.MEM_BODY_PATH ?? path.join(process.cwd(), 'mem-body');

const fabric: Fabric<MEMState> = {
  dof, inv_mass, dof_bound: DOF_BOUND, inv_bound: INV_BOUND,
};


async function verify_body(): Promise<void> {
  const manifest = path.join(BODY_ROOT, 'manifest.json');
  try {
    await fs.access(manifest);
  } catch {
    console.error(`\n[Runtime] MEM body not initialized. Run: npm run init\n`);
    process.exit(1);
  }
}

export interface RuntimeConfig {
  db_path?: string;
}

export async function boot(config: RuntimeConfig = {}) {
  await verify_body();

  // Point SQLite at /mem-body/memory/
  process.env['MEM_DB_PATH'] = config.db_path
    ?? path.join(BODY_ROOT, 'memory', 'mem.db');

  process.on('SIGINT',  () => { console.log('\n\nMEM OS shutting down.'); process.exit(0); });
  process.on('SIGTERM', () => { process.exit(0); });

  const organs   = makeRegistry();
  const services = makeServiceRegistry();
  const receipts = makeReceiptStore();

  // Register built-in organs and services (pre-promoted, trusted)
  services.register(filesystemService);
  organs.register(filesystemOrgan);

  const identity: AgentIdentity = {
    name:         'MEM',
    version:      VERSION,
    session_id:   SESSION_ID,
    capabilities: ['intake', 'plan', 'route', 'run', 'verify', 'remember', 'filesystem'],
  };

  // Construct the API surface — the agent's complete universe.
  // Nothing above this surface is reachable from the agent.
  const api: RuntimeAPI = {
    identity,
    fabric,
    readState:    ()    => loadState(SESSION_ID),
    writeReceipt: (r)   => receipts.write(r),
    readReceipts: (n)   => receipts.latest(n),
    queryRegistry:(intent) => organs.list().filter(o => o.handles(intent)),
    invokeOrgan:  async (step, state) => {
      const organ = organs.get(step.organ);
      if (!organ) throw new Error(`No organ: ${step.organ}`);
      const next = await organ.execute(step, state);
      // Persist any new facts/systems the organ added — agent cannot call commitFact directly
      for (const fact of next.facts.slice(state.facts.length)) {
        commitFact(fact);
      }
      for (const sys of next.systems.slice(state.systems.length)) {
        commitSystem(sys);
      }
      return next;
    },
  };

  await start_agent(api);
}

boot().catch(err => {
  console.error('[Runtime] Fatal:', err);
  process.exit(1);
});
