// Governance tests — proves each rejection type fires correctly and writes a receipt.
// These tests prove the governance claims, not just the code paths.

import { make_proposal, proposal_admissible } from '../agent/proposal';
import { lawful_becoming }                    from '../agent/lawful-becoming';
import { forbidden_scan }                     from '../canon/forbidden';
import { make_traversal_registry }            from '../canon/traversal-registry';
import { verify }                             from '../agent/verifier';
import { MEMState, dof, inv_mass, Step }      from '../agent/state';
import { Intent }                             from '../agent/intake';

const fabric = { dof, inv_mass, dof_bound: 1000, inv_bound: 100_000 };

function make_state(overrides: Partial<MEMState> = {}): MEMState {
  return { session_id: 'test', active_intent: null, open_steps: [], facts: [], systems: [], ...overrides };
}

function make_intent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: 'i1', raw: 'test intent', action: 'resolve', domain: null,
    semantic_op: 'PRESERVE', traversal: 'forward', params: { raw: 'test', semantic_op: 'PRESERVE', traversal: 'forward' },
    timestamp: Date.now(),
    ...overrides,
  };
}

function make_step(overrides: Partial<Step> = {}): Step {
  return { id: 's1', organ: 'test-organ', action: 'resolve', params: { traversal: 'forward' }, requires_human_auth: false, ...overrides };
}

// ── Proposal validation ───────────────────────────────────────────────────────

describe('Proposal validation', () => {
  it('valid proposal is admissible', () => {
    const p = make_proposal(make_intent({ raw: 'build a note' }), make_state());
    expect(proposal_admissible(p)).toBe(true);
    expect(p.status).toBe('valid');
  });

  it('MALFORMED — empty intent', () => {
    const p = make_proposal(make_intent({ raw: '' }), make_state());
    expect(p.status).toBe('malformed');
    expect(proposal_admissible(p)).toBe(false);
  });

  it('MALFORMED — raw exceeds max length', () => {
    const p = make_proposal(make_intent({ raw: 'x'.repeat(2001) }), make_state());
    expect(p.status).toBe('malformed');
  });

  it('STALE — intent older than 30s', () => {
    const p = make_proposal(
      make_intent({ timestamp: Date.now() - 31_000 }),
      make_state(),
    );
    expect(p.status).toBe('stale');
  });

  it('EXCESSIVE — too many open steps', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`, organ: 'x', action: 'a', params: {}, requires_human_auth: false,
    }));
    const p = make_proposal(make_intent(), make_state({ open_steps: steps }));
    expect(p.status).toBe('excessive');
  });

  it('MALFORMED — topology blocks finance + propagation', () => {
    const p = make_proposal(
      make_intent({ domain: 'finance', traversal: 'propagation' }),
      make_state(),
    );
    expect(p.status).toBe('malformed');
    expect(p.reason).toMatch(/propagation/);
  });

  it('MALFORMED — topology blocks security + instantiation', () => {
    const p = make_proposal(
      make_intent({ domain: 'security', traversal: 'instantiation' }),
      make_state(),
    );
    expect(p.status).toBe('malformed');
  });
});

// ── TraversalRegistry — down-down rule ───────────────────────────────────────

describe('TraversalRegistry down-down rule', () => {
  it('allows first downward step', () => {
    const reg = make_traversal_registry();
    expect(reg.check('instantiation').ok).toBe(true);
  });

  it('blocks instantiation → instantiation', () => {
    const reg = make_traversal_registry();
    reg.record('instantiation', 's1');
    const result = reg.check('instantiation');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/down-down/);
  });

  it('blocks instantiation → propagation', () => {
    const reg = make_traversal_registry();
    reg.record('instantiation', 's1');
    expect(reg.check('propagation').ok).toBe(false);
  });

  it('blocks propagation → propagation', () => {
    const reg = make_traversal_registry();
    reg.record('propagation', 's1');
    expect(reg.check('propagation').ok).toBe(false);
  });

  it('allows instantiation → reflective → instantiation', () => {
    const reg = make_traversal_registry();
    reg.record('instantiation', 's1');
    expect(reg.check('reflective').ok).toBe(true);
    reg.record('reflective', 's2');
    expect(reg.check('instantiation').ok).toBe(true);
  });

  it('allows instantiation → reverse → propagation', () => {
    const reg = make_traversal_registry();
    reg.record('instantiation', 's1');
    reg.record('reverse', 's2');
    expect(reg.check('propagation').ok).toBe(true);
  });

  it('tracks down/up counts', () => {
    const reg = make_traversal_registry();
    reg.record('instantiation', 's1');
    reg.record('reverse', 's2');
    reg.record('abstraction', 's3');
    expect(reg.down_count()).toBe(1);
    expect(reg.up_count()).toBe(2);
  });
});

// ── LawfulBecoming ───────────────────────────────────────────────────────────

describe('LawfulBecoming', () => {
  it('lawful when nothing violating occurred', () => {
    const step   = make_step();
    const before = make_state();
    const after  = make_state({ facts: [{ id: 'f1', content: 'ok', source: 'test-organ', timestamp: 1 }] });
    expect(lawful_becoming(step, before, after).lawful).toBe(true);
  });

  it('identity_mutation — session_id changed by organ', () => {
    const step   = make_step();
    const before = make_state({ session_id: 'original' });
    const after  = make_state({ session_id: 'hijacked' });
    const result = lawful_becoming(step, before, after);
    expect(result.lawful).toBe(false);
    expect(result.violations[0].type).toBe('identity_mutation');
  });

  it('scope_exceeded — organ added too many facts', () => {
    const step  = make_step();
    const facts = Array.from({ length: 21 }, (_, i) => ({
      id: `f${i}`, content: 'x', source: 'test-organ', timestamp: 1,
    }));
    const result = lawful_becoming(step, make_state(), make_state({ facts }));
    expect(result.lawful).toBe(false);
    expect(result.violations[0].type).toBe('scope_exceeded');
  });

  it('misattribution — non-builtin organ claims canon source', () => {
    const step  = make_step({ organ: 'external-organ' });
    const after = make_state({ facts: [{ id: 'f1', content: 'x', source: 'canon', timestamp: 1 }] });
    const result = lawful_becoming(step, make_state(), after);
    expect(result.lawful).toBe(false);
    expect(result.violations[0].type).toBe('misattribution');
  });

  it('intent_redirect — organ changed active_intent', () => {
    const step   = make_step();
    const before = make_state({ active_intent: 'original_intent' });
    const after  = make_state({ active_intent: 'redirected_intent' });
    const result = lawful_becoming(step, before, after);
    expect(result.lawful).toBe(false);
    expect(result.violations[0].type).toBe('intent_redirect');
  });
});

// ── ForbiddenTransformation scan ─────────────────────────────────────────────

describe('ForbiddenTransformation scan', () => {
  it('clean when nothing forbidden occurred', () => {
    const step  = make_step();
    const after = make_state({ facts: [{ id: 'f1', content: 'ok', source: 'test-organ', timestamp: 1 }] });
    expect(forbidden_scan(step, make_state(), after).clean).toBe(true);
  });

  it('authority_escalation — external organ claims canon source', () => {
    const step  = make_step({ organ: 'external' });
    const after = make_state({ facts: [{ id: 'f1', content: 'x', source: 'canon', timestamp: 1 }] });
    const result = forbidden_scan(step, make_state(), after);
    expect(result.clean).toBe(false);
    expect(result.violations[0].type).toBe('authority_escalation');
  });

  it('temporal_reordering — existing fact timestamp modified', () => {
    const orig  = { id: 'f1', content: 'x', source: 'test', timestamp: 1000 };
    const mut   = { id: 'f1', content: 'x', source: 'test', timestamp: 9999 };
    const result = forbidden_scan(make_step(), make_state({ facts: [orig] }), make_state({ facts: [mut] }));
    expect(result.clean).toBe(false);
    expect(result.violations[0].type).toBe('temporal_reordering');
  });

  it('constraint_suppression — systems count decreased', () => {
    const sys    = { id: 'sys1', name: 'S', domain: 'test', created_at: 1, receipt_id: 'r1' };
    const before = make_state({ systems: [sys] });
    const after  = make_state({ systems: [] });
    const result = forbidden_scan(make_step(), before, after);
    expect(result.clean).toBe(false);
    expect(result.violations[0].type).toBe('constraint_suppression');
  });

  it('scope_expansion — existing fact id replaced', () => {
    const before = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    const after  = make_state({ facts: [{ id: 'f_replaced', content: 'x', source: 'test', timestamp: 1 }] });
    const result = forbidden_scan(make_step(), before, after);
    expect(result.clean).toBe(false);
    expect(result.violations[0].type).toBe('scope_expansion');
  });
});

// ── Verifier — Canon bounds ───────────────────────────────────────────────────

describe('Verifier Canon bounds', () => {
  it('valid when minmax_law holds', () => {
    const before = make_state({ active_intent: 'x' });
    const after  = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    expect(verify(fabric, before, after).valid).toBe(true);
  });

  it('invalid when dof increases (minmax_law violated)', () => {
    const before = make_state();
    const after  = make_state({ active_intent: 'x' });
    const result = verify(fabric, before, after);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minmax_law/);
  });

  it('invalid when dof exceeds dof_bound', () => {
    const tight_fabric = { dof, inv_mass, dof_bound: 0, inv_bound: 100_000 };
    const after = make_state({ active_intent: 'x' });
    const result = verify(tight_fabric, make_state(), after);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/dof/);
  });
});
