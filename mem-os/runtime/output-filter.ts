// OutputFilter — strips runtime internals from the state returned by invokeOrgan.
//
// The runtime commits full records to the database (receipts, receipt_id links).
// Before the filtered state is returned to the runner, internal-only fields are removed.
// The agent sees governed output, not raw execution artifacts.
//
// Stripped:
//   receipt_id         — written by the runner after execution; not available at organ time
//   source '__internal__' facts — runtime diagnostic artifacts not part of agent knowledge
//
// Preserved:
//   all organ-produced facts, in order
//   all system definitions
//   all state identity and control fields

import { MEMState, Fact } from '../agent/state';

export function filter_output(state: MEMState): MEMState {
  const filtered: Fact[] = state.facts
    .filter(f => f.source !== '__internal__')
    .map(f => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { receipt_id: _drop, ...rest } = f;
      return rest as Fact;
    });

  return { ...state, facts: filtered };
}
