// FileSystem service — the ONLY file access surface MEM has.
// Hard boundary: every path resolves inside WORKSPACE or the call throws.
// Every write produces a receipt entry (handled by the caller via RuntimeAPI).
// Root, system files, and source code are unreachable by construction.

import fs   from 'fs/promises';
import path from 'path';
import { Service } from '../interfaces/service';

const BODY_ROOT = process.env.MEM_BODY_PATH ?? path.join(process.cwd(), 'mem-body');
const WORKSPACE = path.resolve(BODY_ROOT, 'workspace');

export class WorkspaceBoundaryViolation extends Error {
  readonly code = 'WORKSPACE_BOUNDARY_VIOLATION';
  readonly attempted_path: string;
  constructor(relative: string, resolved: string) {
    super(`WorkspaceBoundary: path escapes workspace.\n  requested: ${relative}\n  resolved:  ${resolved}\n  workspace: ${WORKSPACE}`);
    this.attempted_path = resolved;
  }
}

// Resolves a relative path inside workspace.
// Throws WorkspaceBoundaryViolation if resolution escapes workspace.
export function safe_workspace_path(relative: string): string {
  // Normalize first to collapse any .. or . segments before resolving
  const normalized = path.normalize(relative);
  // Reject absolute paths immediately — they bypass the workspace join
  if (path.isAbsolute(normalized)) {
    throw new WorkspaceBoundaryViolation(relative, normalized);
  }
  const resolved = path.resolve(WORKSPACE, normalized);
  const inside   = resolved === WORKSPACE ||
                   resolved.startsWith(WORKSPACE + path.sep);
  if (!inside) throw new WorkspaceBoundaryViolation(relative, resolved);
  return resolved;
}

export type FSAction = 'read' | 'write' | 'list' | 'exists' | 'mkdir';

export interface FSParams {
  path:     string;    // always relative — service resolves it
  content?: string;
}

export const filesystemService: Service = {
  name:                'filesystem',
  description:         'Read/write files inside /mem-body/workspace only. Boundary-enforced.',
  requires_human_auth: false,

  available: async () => {
    try { await fs.access(WORKSPACE); return true; }
    catch { return false; }
  },

  call: async (action: string, params: unknown): Promise<unknown> => {
    const { path: rel, content } = params as FSParams;
    const target = safe_workspace_path(rel);   // throws if outside workspace

    switch (action as FSAction) {
      case 'write':
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content ?? '');
        return { ok: true, written: target };

      case 'read':
        return await fs.readFile(target, 'utf-8');

      case 'list':
        return await fs.readdir(target);

      case 'exists':
        try { await fs.access(target); return true; }
        catch { return false; }

      case 'mkdir':
        await fs.mkdir(target, { recursive: true });
        return { ok: true, created: target };

      default:
        throw new Error(`Unknown filesystem action: ${action}`);
    }
  },
};
