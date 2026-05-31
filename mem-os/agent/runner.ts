// Agent runner — executes steps through the RuntimeAPI.
// The agent does not call organs directly.
// Every invocation is mediated by the runtime.
// Every step outcome — success or failure — writes a receipt. No silent skips.

import { MEMState, Step, dof, inv_mass } from './state';
import { RuntimeAPI }                    from '../runtime/api';
import { gate }                          from './gate';
import { verify }                        from './verifier';
import { lawful_becoming }               from './lawful-becoming';
import { Receipt }                       from '../memory/receipts';
import { requires_human_gate }           from '../canon/auth';
import { forbidden_scan }                from '../canon/forbidden';
import { TraversalRegistry }             from '../canon/traversal-registry';
import { TraversalDir }                  from '../canon/ops';

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
  traversalRegistry?:   TraversalRegistry;
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
      await api.writeReceipt(make_receipt(
        { ...step, action: `unresolved:${step.action}` }, current, current, 'unresolved',
      ));
      opts.onUnresolved?.(step);
      continue;
    }

    // Traversal chain check — down-down is forbidden
    const params    = step.params as Record<string, unknown>;
    const traversal = params.traversal as TraversalDir | undefined;
    if (traversal && opts.traversalRegistry) {
      const tcheck = opts.traversalRegistry.check(traversal);
      if (!tcheck.ok) {
        await api.writeReceipt(make_receipt(
          { ...step, action: `blocked:${step.action}` }, current, current, 'rejected',
        ));
        opts.onRejected?.(step, tcheck.reason ?? 'traversal chain violation');
        continue;
      }
    }

    // Pre-execution: human authorization — organ flag OR action-level gate prefix
    if (step.requires_human_auth || requires_human_gate(step.action)) {
      const approved = await new Promise<boolean>(resolve => {
        opts.onHumanAuthRequired({ step, state: current, resolve });
      });
      if (!approved) {
        await api.writeReceipt(make_receipt(
          { ...step, action: `denied:${step.action}` }, current, current, 'rejected',
        ));
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
        await api.writeReceipt(make_receipt(
          { ...step, action: `security_blocked:${step.action}` }, current, current, 'canon',
        ));
        opts.onSecurityViolation?.(step, e.attempted_path ?? 'unknown');
        continue;
      }

      await api.writeReceipt(make_receipt(
        { ...step, action: `error:${step.action}` }, current, current, 'rejected',
      ));
      opts.onRejected?.(step, e?.message ?? String(err));
      continue;
    }

    // LawfulBecoming — verify derivation before Canon check
    const becoming = lawful_becoming(step, current, next);
    if (!becoming.lawful) {
      const detail = becoming.violations.map(v => `${v.type}: ${v.detail}`).join('; ');
      await api.writeReceipt(make_receipt(
        { ...step, action: `unlawful:${step.action}` }, current, current, 'rejected',
      ));
      opts.onRejected?.(step, `LawfulBecoming: ${detail}`);
      continue;
    }

    // ForbiddenTransformation — scan for the seven structural violations
    const fscan = forbidden_scan(step, current, next);
    if (!fscan.clean) {
      const detail = fscan.violations.map(v => `${v.type}: ${v.detail}`).join('; ');
      await api.writeReceipt(make_receipt(
        { ...step, action: `forbidden:${step.action}` }, current, current, 'rejected',
      ));
      opts.onRejected?.(step, `ForbiddenTransformation: ${detail}`);
      continue;
    }

    // Canon verification — structural bounds and minmax_law
    const check = verify(api.fabric, current, next);
    if (!check.valid) {
      await api.writeReceipt(make_receipt(
        { ...step, action: `invalid:${step.action}` }, current, current, 'rejected',
      ));
      opts.onRejected?.(step, check.reason ?? 'Canon violation');
      continue;
    }

    // Gate check — belt and suspenders on HumanPrimacy
    const gateResult = gate(api.fabric, current, next, step.action);
    if (!gateResult.ok) {
      const reason = gateResult.reason === 'inadmissible'
        ? `inadmissible: dof_delta=${gateResult.dof_delta}, inv_mass_delta=${gateResult.inv_mass_delta}`
        : gateResult.reason;
      await api.writeReceipt(make_receipt(
        { ...step, action: `blocked:${step.action}` }, current, current, 'rejected',
      ));
      opts.onRejected?.(step, reason);
      continue;
    }

    // Commit: write receipt, record traversal, advance state
    await api.writeReceipt(make_receipt(step, current, next, gateResult.auth));
    if (traversal && opts.traversalRegistry) {
      opts.traversalRegistry.record(traversal, step.id);
    }
    current = next;
  }

  return current;
}
