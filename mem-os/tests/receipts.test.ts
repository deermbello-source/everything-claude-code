// Receipt proof trail tests — proves every execution path writes a receipt.
// The governance claim: no step outcome is silent. Every path produces a proof artifact.
// Tests confirm correct auth type for each outcome category.

import { run }                    from '../agent/runner';
import { make_traversal_registry } from '../canon/traversal-registry';
import { MEMState, dof, inv_mass, Step } from '../agent/state';
import { Organ }                  from '../interfaces/organ';
import { Receipt }                from '../memory/receipts';
import { RuntimeAPI }             from '../runtime/api';
import { Fabric }                 from '../canon/fabric';

const fabric: Fabric<MEMState> = { dof, inv_mass, dof_bound: 1000, inv_bound: 100_000 };

function make_state(overrides: Partial<MEMState> = {}): MEMState {
  return { session_id: 'test', active_intent: null, open_steps: [], facts: [], systems: [], ...overrides };
}

function make_api(organ: Organ, receipts: Receipt[]): RuntimeAPI {
  return {
    identity:      { name: 'MEM', version: '0.1.0', session_id: 'test', capabilities: [] },
    fabric,
    readState:     async () => make_state(),
    writeReceipt:  async (r) => { receipts.push(r); },
    readReceipts:  async (n) => receipts.slice(-n),
    queryRegistry: (intent) => organ.handles(intent) ? [organ] : [],
    invokeOrgan:   async (step, state) => organ.execute(step, state),
    traversalStats: () => ({ down: 0, up: 0, last: null }),
  };
}

function good_organ(): Organ {
  return {
    name: 'good', description: '', requires_human_auth: false,
    handles: () => true, dof_cost: () => 1, inv_gain: () => 1,
    execute: async (_step, state) => ({
      ...state,
      active_intent: null,
      open_steps: [],
      facts: [...state.facts, { id: `f_${Date.now()}`, content: 'ok', source: 'good', timestamp: Date.now() }],
    }),
  };
}

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: 's1', organ: 'good', action: 'resolve',
    params: { raw: 'test', semantic_op: 'PRESERVE', traversal: 'forward' },
    requires_human_auth: false,
    ...overrides,
  };
}

// ── Every path writes exactly one receipt ────────────────────────────────────

describe('Receipt written for every outcome', () => {
  it('success → auth: canon', async () => {
    const receipts: Receipt[] = [];
    const state = make_state({ active_intent: 'test' });
    await run([step()], state, make_api(good_organ(), receipts), {
      onHumanAuthRequired: () => {},
      traversalRegistry:   make_traversal_registry(),
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('canon');
  });

  it('unresolved organ → auth: unresolved', async () => {
    const receipts: Receipt[] = [];
    await run([step({ organ: '__unresolved__' })], make_state(), make_api(good_organ(), receipts), {
      onHumanAuthRequired: () => {},
      traversalRegistry:   make_traversal_registry(),
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('unresolved');
  });

  it('human denied → auth: rejected', async () => {
    const receipts: Receipt[] = [];
    await run(
      [step({ requires_human_auth: true })],
      make_state({ active_intent: 'test' }),
      make_api(good_organ(), receipts),
      {
        onHumanAuthRequired: ({ resolve }) => resolve(false),
        traversalRegistry:   make_traversal_registry(),
      },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('rejected');
    expect(receipts[0].step.action).toMatch(/^denied:/);
  });

  it('organ throws generic error → auth: rejected', async () => {
    const receipts: Receipt[] = [];
    const erroring_organ: Organ = {
      ...good_organ(), name: 'bad',
      execute: async () => { throw new Error('runtime error'); },
    };
    const api = make_api(erroring_organ, receipts);
    await run(
      [step({ organ: 'bad' })],
      make_state({ active_intent: 'test' }),
      api,
      { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('rejected');
    expect(receipts[0].step.action).toMatch(/^error:/);
  });

  it('workspace boundary violation → auth: canon (security receipt)', async () => {
    const receipts: Receipt[] = [];
    const boundary_organ: Organ = {
      ...good_organ(), name: 'boundary-test',
      execute: async () => {
        const err: NodeJS.ErrnoException & { code?: string; attempted_path?: string } =
          new Error('boundary violation');
        err.code = 'WORKSPACE_BOUNDARY_VIOLATION';
        err.attempted_path = '/etc/passwd';
        throw err;
      },
    };
    await run(
      [step({ organ: 'boundary-test' })],
      make_state({ active_intent: 'test' }),
      make_api(boundary_organ, receipts),
      {
        onHumanAuthRequired: () => {},
        traversalRegistry:   make_traversal_registry(),
        onSecurityViolation: () => {},
      },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('canon');
    expect(receipts[0].step.action).toMatch(/^security_blocked:/);
  });

  it('Canon violation (minmax_law) → auth: rejected', async () => {
    const receipts: Receipt[] = [];
    const dof_increasing_organ: Organ = {
      ...good_organ(), name: 'dof-increaser',
      execute: async (_step, state) => ({
        ...state,
        active_intent: 'new_intent_that_raises_dof',
        open_steps: [{ id: 'new', organ: 'x', action: 'y', params: {}, requires_human_auth: false }],
      }),
    };
    await run(
      [step({ organ: 'dof-increaser' })],
      make_state(),
      make_api(dof_increasing_organ, receipts),
      { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('rejected');
  });

  it('down-down traversal → auth: rejected', async () => {
    const receipts: Receipt[] = [];
    const reg = make_traversal_registry();
    reg.record('instantiation', 'prior');

    await run(
      [step({ params: { raw: 'x', semantic_op: 'PRESERVE', traversal: 'instantiation' } })],
      make_state({ active_intent: 'test' }),
      make_api(good_organ(), receipts),
      { onHumanAuthRequired: () => {}, traversalRegistry: reg },
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].auth).toBe('rejected');
  });
});

// ── Receipt fields are correct ───────────────────────────────────────────────

describe('Receipt field correctness', () => {
  it('receipt captures dof and inv_mass before and after', async () => {
    const receipts: Receipt[] = [];
    const state = make_state({ active_intent: 'test' });
    await run([step()], state, make_api(good_organ(), receipts), {
      onHumanAuthRequired: () => {},
      traversalRegistry:   make_traversal_registry(),
    });
    const r = receipts[0];
    expect(r.dof_before).toBe(dof(state));
    expect(typeof r.dof_after).toBe('number');
    expect(typeof r.inv_mass_after).toBe('number');
    expect(r.timestamp).toBeGreaterThan(0);
  });
});
