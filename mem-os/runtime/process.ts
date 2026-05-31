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
import { make_traversal_registry }       from '../canon/traversal-registry';
import { filesystemOrgan }               from '../organs/filesystem-organ';
import { filesystemService }             from '../services/filesystem';
import { assimilate }                    from '../organs/assimilation';
import { filter_output }                 from './output-filter';

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

  process.env['MEM_DB_PATH'] = config.db_path
    ?? path.join(BODY_ROOT, 'memory', 'mem.db');

  process.on('SIGINT',  () => { console.log('\n\nMEM OS shutting down.'); process.exit(0); });
  process.on('SIGTERM', () => { process.exit(0); });

  const organs   = makeRegistry();
  const services = makeServiceRegistry();
  const receipts = makeReceiptStore();
  const tregistry = make_traversal_registry();

  // Register built-in services first (needed by organs)
  services.register(filesystemService);

  // Built-in organs pass through assimilation (classify + wrap) then register directly.
  // They skip quarantine — they are pre-trusted, but still governed by the wrap surface.
  const { organ: fsOrgan } = assimilate(filesystemOrgan);
  organs.register(fsOrgan);

  const identity: AgentIdentity = {
    name:         'MEM',
    version:      VERSION,
    session_id:   SESSION_ID,
    capabilities: [
      'intake', 'plan', 'proposal', 'route', 'run',
      'lawful-becoming', 'forbidden-scan', 'traversal-registry',
      'verify', 'remember', 'filesystem',
    ],
  };

  const api: RuntimeAPI = {
    identity,
    fabric,
    readState:    ()    => loadState(SESSION_ID),
    writeReceipt: (r)   => receipts.write(r),
    readReceipts: (n)   => receipts.latest(n),
    queryRegistry:(intent) => organs.list().filter(o => o.handles(intent)),

    invokeOrgan: async (step, state) => {
      const organ = organs.get(step.organ);
      if (!organ) throw new Error(`No organ: ${step.organ}`);
      const raw_next = await organ.execute(step, state);
      // Persist new facts/systems — agent cannot call commitFact directly
      for (const fact of raw_next.facts.slice(state.facts.length)) {
        commitFact(fact);
      }
      for (const sys of raw_next.systems.slice(state.systems.length)) {
        commitSystem(sys);
      }
      // Filter runtime internals before returning to the runner
      return filter_output(raw_next);
    },

    traversalStats: () => ({
      down: tregistry.down_count(),
      up:   tregistry.up_count(),
      last: tregistry.last_entry()?.traversal ?? null,
    }),
  };

  await start_agent(api, tregistry);
}

boot().catch(err => {
  console.error('[Runtime] Fatal:', err);
  process.exit(1);
});
