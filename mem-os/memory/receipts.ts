// Receipt — proof artifact of every Canon-governed transition.
// Append-only. Never deleted. The running proof trace.

import { Step } from '../agent/state';
import { AuthSource } from '../canon/auth';

export interface Receipt {
  id:               string;
  intent_id:        string;
  step:             Step;
  dof_before:       number;
  inv_mass_before:  number;
  dof_after:        number;
  inv_mass_after:   number;
  auth:             AuthSource;
  timestamp:        number;
}

export interface ReceiptStore {
  write:  (receipt: Receipt) => Promise<void>;
  read:   (id: string) => Promise<Receipt | null>;
  since:  (timestamp: number) => Promise<Receipt[]>;
  all:    () => Promise<Receipt[]>;
  latest: (n: number) => Promise<Receipt[]>;
}
