// Pipeline tests — proves the full intake→plan→run sequence behaves correctly.
// Uses a mock organ and mock API so no filesystem or SQLite is required.
// Every test verifies observable behavior, not internal code paths.

import { intake }                from '../agent/intake';
import { plan }                  from '../agent/planner';
import { run, RunnerOptions }    from '../agent/runner';
import { make_traversal_registry } from '../canon/traversal-registry';
import { MEMState, dof, inv_mass, Step } from '../agent/state';
import { Organ }                 from '../interfaces/organ';
import { Intent }                from '../agent/intake';
import { Receipt }               from '../memory/receipts';
import { RuntimeAPI }            from '../runtime/api';
import { Fabric }                from '../canon/fabric';

const fabric: Fabric<MEMState> = { dof, inv_mass, dof_bound: 1000, inv_bound: 100_000 };

function make_state(overrides: Partial<MEMState> = {}): MEMState {
  return { session_id: 'test', active_intent: null, open_steps: [], facts: [], systems: [], ...overrides };
}

function make_mock_organ(name: string, handles_actions: string[] = ['resolve', 'report', 'search', 'remember', 'build', 'calculate']): Organ {
  return {
    name,
    description:         `mock organ: ${name}`,
    requires_human_auth: false,
    handles:             (intent: Intent) => handles_actions.includes(intent.action),
    dof_cost:            () => 1,
    inv_gain:            () => 1,
    execute: async (_step: Step, state: MEMState): Promise<MEMState> => ({
      ...state,
      active_intent: null,
      open_steps:    [],
      facts:         [...state.facts, { id: `fact_${Date.now()}`, content: 'done', source: name, timestamp: Date.now() }],
    }),
  };
}

function make_mock_api(organ: Organ, receipts_store: Receipt[]): RuntimeAPI {
  return {
    identity: { name: 'MEM', version: '0.1.0', session_id: 'test', capabilities: [] },
    fabric,
    readState:     async () => make_state(),
    writeReceipt:  async (r) => { receipts_store.push(r); },
    readReceipts:  async (n) => receipts_store.slice(-n),
    queryRegistry: (intent) => organ.handles(intent) ? [organ] : [],
    invokeOrgan:   async (step, state) => organ.execute(step, state),
    traversalStats: () => ({ down: 0, up: 0, last: null }),
  };
}

// ── Happy path ───────────────────────────────────────────────────────────────

describe('Pipeline happy path', () => {
  it('intent → plan → run → fact committed → receipt written', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const api    = make_mock_api(organ, receipts);
    const state  = make_state();
    const intent = intake('show me the files');
    const steps  = plan(intent, state, api);
    const after  = await run(steps, state, api, { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() });

    expect(after.facts.length).toBeGreaterThan(0);
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts[0].auth).toBe('canon');
  });

  it('inv_mass grows after successful execution', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const api    = make_mock_api(organ, receipts);
    const state  = make_state();
    const intent = intake('remember this note');
    const steps  = plan(intent, state, api);
    const after  = await run(steps, state, api, { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() });

    expect(inv_mass(after)).toBeGreaterThan(inv_mass(state));
  });
});

// ── Proposal rejection ────────────────────────────────────────────────────────

describe('Pipeline proposal rejection', () => {
  it('empty intent → unresolved step, receipt written', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const api    = make_mock_api(organ, receipts);
    const state  = make_state();
    const intent = intake('');
    const steps  = plan(intent, state, api);

    expect(steps[0].action).toBe('proposal:malformed');

    await run(steps, state, api, { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() });
    expect(receipts.length).toBeGreaterThan(0);
    expect(receipts[0].auth).toBe('unresolved');
  });

  it('finance domain + propagation → proposal:malformed', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const api    = make_mock_api(organ, receipts);
    const state  = make_state();
    const intent = intake('deploy the financial report');
    // Manually override domain and traversal to force topology check
    const forced_intent = { ...intent, domain: 'finance', traversal: 'propagation' as const };
    const steps  = plan(forced_intent, state, api);

    expect(steps[0].action).toBe('proposal:malformed');
  });
});

// ── Down-down traversal block ────────────────────────────────────────────────

describe('Pipeline down-down traversal block', () => {
  it('instantiation → instantiation is blocked, rejection receipt written', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const reg    = make_traversal_registry();
    reg.record('instantiation', 'prior-step');

    const api = make_mock_api(organ, receipts);
    const state = make_state();

    const step: Step = {
      id:                  's_down2',
      organ:               'test-organ',
      action:              'build',
      params:              { raw: 'build it', semantic_op: 'PRESERVE', traversal: 'instantiation' },
      requires_human_auth: false,
    };

    const rejected: string[] = [];
    await run([step], state, api, {
      onHumanAuthRequired: () => {},
      traversalRegistry:   reg,
      onRejected:          (_, reason) => rejected.push(reason),
    });

    expect(rejected.length).toBe(1);
    expect(rejected[0]).toMatch(/down-down/);
    expect(receipts.length).toBe(1);
    expect(receipts[0].auth).toBe('rejected');
  });

  it('instantiation → reflective → instantiation is allowed', async () => {
    const receipts: Receipt[] = [];
    const organ  = make_mock_organ('test-organ');
    const reg    = make_traversal_registry();
    reg.record('instantiation', 's1');
    reg.record('reflective', 's2');   // resets the chain

    const api   = make_mock_api(organ, receipts);
    const state = make_state({ active_intent: 'test' });

    const step: Step = {
      id:                  's3',
      organ:               'test-organ',
      action:              'build',
      params:              { raw: 'build', semantic_op: 'PRESERVE', traversal: 'instantiation' },
      requires_human_auth: false,
    };

    const rejected: string[] = [];
    await run([step], state, api, {
      onHumanAuthRequired: () => {},
      traversalRegistry:   reg,
      onRejected:          (_, reason) => rejected.push(reason),
    });

    expect(rejected.length).toBe(0);
  });
});

// ── DISSOLVE is blocked ──────────────────────────────────────────────────────

describe('Pipeline DISSOLVE preservation-first', () => {
  it('delete intent → organ throws DISSOLVE error → rejection receipt written', async () => {
    const receipts: Receipt[] = [];
    const dissolve_organ: Organ = {
      name:                'dissolve-test',
      description:         'test',
      requires_human_auth: false,
      handles:             () => true,
      dof_cost:            () => 1,
      inv_gain:            () => 0,
      execute: async () => { throw new Error('DISSOLVE blocked: Preservation-First active.'); },
    };
    const api   = make_mock_api(dissolve_organ, receipts);
    const state = make_state({ active_intent: 'delete test' });

    const step: Step = {
      id:                  's_dissolve',
      organ:               'dissolve-test',
      action:              'resolve',
      params:              { raw: 'delete everything', semantic_op: 'DISSOLVE', traversal: 'forward' },
      requires_human_auth: false,
    };

    const rejected: string[] = [];
    await run([step], state, api, {
      onHumanAuthRequired: () => {},
      traversalRegistry:   make_traversal_registry(),
      onRejected:          (_, r) => rejected.push(r),
    });

    expect(rejected.length).toBe(1);
    expect(rejected[0]).toMatch(/DISSOLVE/);
    expect(receipts.length).toBe(1);
    expect(receipts[0].auth).toBe('rejected');
  });
});

// ── No organ → unresolved receipt ────────────────────────────────────────────

describe('Pipeline unresolved organ', () => {
  it('no matching organ → unresolved receipt written', async () => {
    const receipts: Receipt[] = [];
    const organ = make_mock_organ('limited', ['only_this_action']);
    const api   = make_mock_api(organ, receipts);

    const intent = intake('do something completely different');
    const steps  = plan(intent, make_state(), api);

    // Plan returns unresolved (no organ handles it)
    expect(steps[0].organ).toBe('__unresolved__');

    await run(steps, make_state(), api, { onHumanAuthRequired: () => {}, traversalRegistry: make_traversal_registry() });
    expect(receipts[0].auth).toBe('unresolved');
  });
});
