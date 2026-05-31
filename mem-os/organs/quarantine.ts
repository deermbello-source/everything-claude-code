// Organ quarantine — every new organ submitted from outside starts here.
// Cannot be invoked until promoted by the user (HumanPrimacy).
// Built-in organs (filesystem, resolver) are pre-promoted.

import fs   from 'fs/promises';
import path from 'path';
import { OrganRegistry } from '../interfaces/organ';

const BODY_ROOT   = process.env.MEM_BODY_PATH ?? path.join(process.cwd(), 'mem-body');
const QUARANTINE  = path.join(BODY_ROOT, 'quarantine');
const REGISTRY_F  = path.join(BODY_ROOT, 'registry', 'quarantine.json');

export type QuarantineStatus = 'quarantined' | 'promoted' | 'rejected';

export interface QuarantinedOrgan {
  name:           string;
  submitted_at:   number;
  promoted_at?:   number;
  rejected_at?:   number;
  status:         QuarantineStatus;
  source_hash?:   string;
}

async function load(): Promise<QuarantinedOrgan[]> {
  try {
    return JSON.parse(await fs.readFile(REGISTRY_F, 'utf-8')) as QuarantinedOrgan[];
  } catch {
    return [];
  }
}

async function save(records: QuarantinedOrgan[]): Promise<void> {
  await fs.mkdir(path.dirname(REGISTRY_F), { recursive: true });
  await fs.writeFile(REGISTRY_F, JSON.stringify(records, null, 2));
}

export async function quarantine_organ(name: string): Promise<void> {
  const records = await load();
  records.push({ name, submitted_at: Date.now(), status: 'quarantined' });
  await save(records);
}

export async function promote_organ(
  name:     string,
  registry: OrganRegistry,
  organ:    Parameters<OrganRegistry['register']>[0],
): Promise<boolean> {
  const records = await load();
  const entry   = records.find(r => r.name === name && r.status === 'quarantined');
  if (!entry) return false;
  entry.status      = 'promoted';
  entry.promoted_at = Date.now();
  await save(records);
  registry.register(organ);
  return true;
}

export async function list_quarantined(): Promise<QuarantinedOrgan[]> {
  return (await load()).filter(r => r.status === 'quarantined');
}

export async function is_quarantined(name: string): Promise<boolean> {
  return (await load()).some(r => r.name === name && r.status === 'quarantined');
}
