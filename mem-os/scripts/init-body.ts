// Initializes the MEM body — the sandboxed local filesystem world.
// Run once before starting MEM OS.
// Creates the physical boundary that the RuntimeAPI enforces.

import fs   from 'fs/promises';
import path from 'path';

const BODY_ROOT = process.env.MEM_BODY_PATH ?? path.join(process.cwd(), 'mem-body');

const DIRS = [
  'inbox',       // incoming intents or files dropped in from outside
  'workspace',   // where organs can read/write (the only writable zone)
  'organs',      // organ definitions loaded by the registry
  'memory',      // facts, state (SQLite lives here)
  'receipts',    // proof trace (JSON mirror of SQLite receipts)
  'registry',    // registry state, organ manifests
  'quarantine',  // new organs land here first, promoted by user
];

async function init_body() {
  for (const dir of DIRS) {
    await fs.mkdir(path.join(BODY_ROOT, dir), { recursive: true });
  }

  // Write a manifest so the runtime can verify body integrity on startup
  const manifest = {
    version:      '0.1.0',
    initialized:  new Date().toISOString(),
    body_root:    BODY_ROOT,
    dirs:         DIRS,
    invariants: [
      'HumanPrimacy: no path from agent state to authorization',
      'SourceIsolation: no path from agent state to agent source',
      'WorkspaceBoundary: no file write outside /mem-body/workspace',
      'ReceiptOnWrite: every file write produces a receipt',
      'OrganQuarantine: every new organ starts quarantined',
    ],
  };

  await fs.writeFile(
    path.join(BODY_ROOT, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log(`\nMEM body initialized at ${BODY_ROOT}`);
  console.log('Directories:');
  DIRS.forEach(d => console.log(`  ${path.join(BODY_ROOT, d)}`));
  console.log('\nInvariants locked:\n');
  manifest.invariants.forEach(i => console.log(`  ✓ ${i}`));
  console.log('');
}

init_body().catch(err => {
  console.error('[init-body] Fatal:', err);
  process.exit(1);
});
