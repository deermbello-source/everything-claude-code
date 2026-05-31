// Agent loop — the agent process.
// Receives a RuntimeAPI. That is its complete world.
// It does not import from memory/, interfaces/, canon/, or runtime/.
// Information flows downward. The agent cannot traverse upward.

import * as readline             from 'readline';
import { RuntimeAPI }            from '../runtime/api';
import { intake }                from './intake';
import { plan }                  from './planner';
import { run }                   from './runner';
import { omega, canonicality, drift_level } from '../canon/fabric';
import { MEMState }              from './state';

function status(api: RuntimeAPI, state: MEMState): string {
  const c = (canonicality(api.fabric, state) * 100).toFixed(1);
  const d = (drift_level(api.fabric, state)  * 100).toFixed(1);
  const Ω = omega(api.fabric, 1, 1, state).toFixed(0);
  return `canonicality ${c}%  ·  drift ${d}%  ·  Ω ${Ω}`;
}

// Commands the agent understands — operating on what the runtime exposes
async function handle_command(
  cmd:   string,
  api:   RuntimeAPI,
  state: MEMState,
): Promise<boolean> {
  switch (cmd) {
    case '/status':
      console.log(`\n  ${api.identity.name} v${api.identity.version}  ·  ${api.identity.session_id}`);
      console.log(`  capabilities: ${api.identity.capabilities.join(', ')}`);
      console.log(`  ${status(api, state)}\n`);
      return true;
    case '/receipts': {
      const rs = await api.readReceipts(10);
      if (!rs.length) { console.log('\n  No receipts yet.\n'); return true; }
      console.log('\nLast 10 receipts:');
      rs.forEach(r => {
        console.log(`  ${r.id}  dof ${r.dof_before}→${r.dof_after}  inv_mass ${r.inv_mass_before}→${r.inv_mass_after}  [${r.auth}]`);
      });
      console.log('');
      return true;
    }
    case '/organs': {
      const intent_all = intake('*');
      const organs = api.queryRegistry(intent_all);
      if (!organs.length) {
        console.log('\n  Registry empty. No organs loaded.\n');
      } else {
        console.log('\nOrgans:');
        organs.forEach(o => console.log(`  ${o.name}  ${o.requires_human_auth ? '[auth]' : ''}  —  ${o.description}`));
        console.log('');
      }
      return true;
    }
    default:
      return false;
  }
}

export async function start_agent(api: RuntimeAPI) {
  const rl    = readline.createInterface({ input: process.stdin, output: process.stdout });
  let   state = await api.readState();

  console.log(`\n${api.identity.name} v${api.identity.version}  ·  ${api.identity.session_id}`);
  console.log(status(api, state));
  console.log('\n● SUPERPOSITION\n');

  function prompt() {
    rl.question('> ', (raw) => {
      const trimmed = raw.trim();
      if (!trimmed)            { prompt(); return; }
      if (trimmed === '/exit') { rl.close(); return; }

      (async () => {
        const handled = await handle_command(trimmed, api, state);
        if (handled) { prompt(); return; }

        const intent = intake(trimmed);
        const steps  = plan(intent, state, api);

        state = await run(steps, state, api, {
          onHumanAuthRequired: ({ step, resolve }) => {
            rl.question(`\n  Authorize: ${step.action} [y/N] `, ans => {
              resolve(ans.trim().toLowerCase() === 'y');
              console.log('');
            });
          },
          onUnresolved: (step) => {
            const p = step.params as { intent_action?: string; intent_domain?: string };
            console.log(`\n  No organ for "${p.intent_action ?? 'unknown'}"${p.intent_domain ? ` in ${p.intent_domain}` : ''}.`);
            console.log('  Register an organ to handle this intent.\n');
          },
          onRejected: (_step, reason) => {
            console.log(`\n  Rejected: ${reason}\n`);
          },
          onSecurityViolation: (step, attempted) => {
            console.log(`\n  ■ SECURITY: WorkspaceBoundary blocked ${step.action}`);
            console.log(`    attempted path: ${attempted}`);
            console.log(`    no write occurred. security receipt written.\n`);
          },
        });

        console.log('\n● SUPERPOSITION  ·  ' + status(api, state) + '\n');
        prompt();
      })().catch(err => {
        console.error('\n[MEM] Unhandled error in agent loop:', err);
        prompt();
      });
    });
  }

  prompt();
}
