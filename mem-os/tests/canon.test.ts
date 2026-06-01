// Canon law tests — proves the formal invariants hold in code.
// Every test here corresponds to a named claim in the Canon.lean kernel.

import { minmax_law, permutation_stable, addressability_integrity, MINIMAL_INVARIANT_MASS } from '../canon/fabric';
import { classify_semantic_op, classify_traversal }  from '../canon/ops';
import { traversal_polarity }                        from '../canon/traversal-registry';
import { is_traversal_lawful, traversal_constraint_reason } from '../canon/topology';
import { MEMState, dof, inv_mass, canonical_facts, simulation_facts } from '../agent/state';

function make_state(overrides: Partial<MEMState> = {}): MEMState {
  return {
    session_id:    'test_session',
    active_intent: null,
    open_steps:    [],
    facts:         [],
    systems:       [],
    ...overrides,
  };
}

const fabric = {
  dof,
  inv_mass,
  dof_bound:  1000,
  inv_bound:  100_000,
};

// ── minmax_law ───────────────────────────────────────────────────────────────

describe('minmax_law', () => {
  it('holds when dof decreases and inv_mass increases', () => {
    const before = make_state({ open_steps: [{ id: 's1', organ: 'x', action: 'a', params: {}, requires_human_auth: false }] });
    const after  = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    expect(minmax_law(fabric, before, after)).toBe(true);
  });

  it('holds when state is unchanged (permutation stable)', () => {
    const s = make_state();
    expect(minmax_law(fabric, s, s)).toBe(true);
  });

  it('fails when dof increases', () => {
    const before = make_state();
    const after  = make_state({ active_intent: 'some_intent' });
    expect(minmax_law(fabric, before, after)).toBe(false);
  });

  it('fails when inv_mass decreases', () => {
    const before = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    const after  = make_state();
    expect(minmax_law(fabric, before, after)).toBe(false);
  });
});

// ── permutation_stable ───────────────────────────────────────────────────────

describe('permutation_stable', () => {
  it('true when dof and inv_mass are identical', () => {
    const s = make_state();
    expect(permutation_stable(fabric, s, s)).toBe(true);
  });

  it('false when inv_mass changed', () => {
    const before = make_state();
    const after  = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    expect(permutation_stable(fabric, before, after)).toBe(false);
  });
});

// ── addressability_integrity ─────────────────────────────────────────────────

describe('addressability_integrity', () => {
  it('fails below MINIMAL_INVARIANT_MASS', () => {
    const s = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    expect(addressability_integrity(fabric, s)).toBe(false);
  });

  it('passes at MINIMAL_INVARIANT_MASS', () => {
    const facts = Array.from({ length: MINIMAL_INVARIANT_MASS }, (_, i) => ({
      id: `f${i}`, content: 'x', source: 'test', timestamp: 1,
    }));
    expect(addressability_integrity(fabric, make_state({ facts }))).toBe(true);
  });
});

// ── canonical/simulation separation ─────────────────────────────────────────

describe('canonical vs simulation state', () => {
  it('inv_mass counts only canonical facts', () => {
    const s = make_state({
      facts: [
        { id: 'f1', content: 'x', source: 'test', timestamp: 1, layer: 'canonical' },
        { id: 'f2', content: 'x', source: 'test', timestamp: 1, layer: 'simulation' },
      ],
    });
    expect(inv_mass(s)).toBe(1);
  });

  it('canonical_facts returns only canonical layer', () => {
    const s = make_state({
      facts: [
        { id: 'f1', content: 'x', source: 'test', timestamp: 1, layer: 'canonical' },
        { id: 'f2', content: 'x', source: 'test', timestamp: 1, layer: 'simulation' },
      ],
    });
    expect(canonical_facts(s)).toHaveLength(1);
    expect(simulation_facts(s)).toHaveLength(1);
  });

  it('undefined layer is treated as canonical', () => {
    const s = make_state({ facts: [{ id: 'f1', content: 'x', source: 'test', timestamp: 1 }] });
    expect(inv_mass(s)).toBe(1);
    expect(canonical_facts(s)).toHaveLength(1);
  });
});

// ── classify_semantic_op ─────────────────────────────────────────────────────

describe('classify_semantic_op', () => {
  it('DISSOLVE for destructive keywords', () => {
    expect(classify_semantic_op('delete the file')).toBe('DISSOLVE');
    expect(classify_semantic_op('remove all records')).toBe('DISSOLVE');
  });
  it('REFLECT for read keywords', () => {
    expect(classify_semantic_op('show me the files')).toBe('REFLECT');
    expect(classify_semantic_op('list all notes')).toBe('REFLECT');
  });
  it('TRANSMIT for write keywords', () => {
    expect(classify_semantic_op('save this note')).toBe('TRANSMIT');
    expect(classify_semantic_op('record this')).toBe('TRANSMIT');
  });
  it('PRESERVE as safe default', () => {
    expect(classify_semantic_op('do something')).toBe('PRESERVE');
  });
});

// ── classify_traversal ───────────────────────────────────────────────────────

describe('classify_traversal', () => {
  it('instantiation for build/create', () => {
    expect(classify_traversal('build a new component')).toBe('instantiation');
  });
  it('reflective for status/self-check', () => {
    expect(classify_traversal('what is the current status')).toBe('reflective');
  });
  it('reverse for trace/rollback', () => {
    expect(classify_traversal('trace the origin of this')).toBe('reverse');
  });
  it('forward as default', () => {
    expect(classify_traversal('do something generic')).toBe('forward');
  });
});

// ── traversal_polarity ───────────────────────────────────────────────────────

describe('traversal_polarity', () => {
  it('instantiation and propagation are down', () => {
    expect(traversal_polarity('instantiation')).toBe('down');
    expect(traversal_polarity('propagation')).toBe('down');
  });
  it('reverse and abstraction are up', () => {
    expect(traversal_polarity('reverse')).toBe('up');
    expect(traversal_polarity('abstraction')).toBe('up');
  });
  it('reflective and forward are lateral', () => {
    expect(traversal_polarity('reflective')).toBe('lateral');
    expect(traversal_polarity('forward')).toBe('lateral');
  });
});

// ── topology map ─────────────────────────────────────────────────────────────

describe('topology map', () => {
  it('finance cannot propagate', () => {
    expect(is_traversal_lawful('finance', 'propagation')).toBe(false);
  });
  it('finance cannot instantiate', () => {
    expect(is_traversal_lawful('finance', 'instantiation')).toBe(false);
  });
  it('security cannot propagate or instantiate', () => {
    expect(is_traversal_lawful('security', 'propagation')).toBe(false);
    expect(is_traversal_lawful('security', 'instantiation')).toBe(false);
  });
  it('finance can reflect and reverse', () => {
    expect(is_traversal_lawful('finance', 'reflective')).toBe(true);
    expect(is_traversal_lawful('finance', 'reverse')).toBe(true);
  });
  it('logistics can propagate and instantiate', () => {
    expect(is_traversal_lawful('logistics', 'propagation')).toBe(true);
    expect(is_traversal_lawful('logistics', 'instantiation')).toBe(true);
  });
  it('unknown domain is unconstrained', () => {
    expect(is_traversal_lawful('unknown_domain', 'propagation')).toBe(true);
  });
  it('constraint_reason is non-null for blocked pairs', () => {
    expect(traversal_constraint_reason('finance', 'propagation')).toBeTruthy();
    expect(traversal_constraint_reason('finance', 'reflective')).toBeNull();
  });
});
