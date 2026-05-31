// Agent runner — executes steps through the RuntimeAPI.
// The agent does not call organs directly.
// Every invocation is mediated by the runtime.
// WorkspaceBoundaryViolation → security receipt, no state change, no write.

import { MEMState, Step, dof, inv_mass } from './state';
import { RuntimeAPI }                    from '../runtime/api';
import { gate }                          from './gate';
import { verify }                        from './verifier';
import { Receipt }                       from '../memory/receipts';

export interface HumanAuthRequest {
  step:    Step;
  state:   MEMState;
  resolve: (approved: boolean) => void;
}

export interface RunnerOptions {
  onHumanAuthRequired:  (req: HumanAuthRequest) => void;
  onUnresolved?:        (step: Step) => void;
  onRejected?:          (step: Step, reason: string) => void;
  onSecurityViolation?: (step: Step, attempted_path: string) => void;
}

function make_receipt(step: Step, before: MEMState, after: MEMState, auth: Receipt['auth']): Receipt {
  const now = Date.now();
  return {
    id:              `receipt_${now}_${Math.random().toString(36).slice(2, 7)}`,
    intent_id:       step.id,
    step,
    dof_before:      dof(before),
    inv_mass_before: inv_mass(before),
    dof_after:       dof(after),
    inv_mass_after:  inv_mass(after),
    auth,
    timestamp:       now,
  };
}

export async function run(
  steps: Step[],
  state: MEMState,
  api:   RuntimeAPI,
  opts:  RunnerOptions,
): Promise<MEMState> {
  let current = state;

  for (const step of steps) {
    if (step.organ === '__unresolved__') {
      opts.onUnresolved?.(step);
      continue;
    }

    // Pre-execution: human authorization gate
    if (step.requires_human_auth) {
      const approved = await new Promise<boolean>(resolve => {
        opts.onHumanAuthRequired({ step, state: current, resolve });
      });
      if (!approved) {
        opts.onRejected?.(step, 'human denied');
        continue;
      }
    }

    // Execute through the runtime — not directly
    let next: MEMState;
    try {
      next = await api.invokeOrgan(step, current);
    } catch (err: unknown) {
      const e = err as { code?: string; attempted_path?: string; message?: string };

      if (e?.code === 'WORKSPACE_BOUNDARY_VIOLATION') {
        // Security receipt — no write, no state change, proof of block
        const security_step: Step = { ...step, action: `security_blocked:${step.action}` };
        await api.writeReceipt(make_receipt(security_step, current, current, 'canon'));
        opts.onSecurityViolation?.(step, e.attempted_path ?? 'unknown');
        continue;
      }

      opts.onRejected?.(step, e?.message ?? String(err));
      continue;
    }

    // Verify result satisfies Canon
    const check = verify(api.fabric, current, next);
    if (!check.valid) {
      opts.onRejected?.(step, check.reason ?? 'Canon violation');
      continue;
    }

    // Gate check — belt and suspenders on HumanPrimacy
    const gateResult = gate(api.fabric, current, next, step.action);
    if (!gateResult.ok) {
      opts.onRejected?.(step, gateResult.reason);
      continue;
    }

    // Commit: write receipt and advance state
    await api.writeReceipt(make_receipt(step, current, next, gateResult.auth));
    current = next;
  }

  return current;
}
