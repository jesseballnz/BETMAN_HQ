import { Assumptions, DEFAULT_ASSUMPTIONS } from '@/lib/types';

// In a production app this would connect to a database.
// For now we use a module-level variable (persists per Node process, resets on server restart).
// Replace with a DB-backed store to persist across restarts.

let currentAssumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS };

export function getAssumptions(): Assumptions {
  return currentAssumptions;
}

export function updateAssumptions(partial: Partial<Assumptions>): Assumptions {
  currentAssumptions = { ...currentAssumptions, ...partial };
  return currentAssumptions;
}

export function resetAssumptions(): Assumptions {
  currentAssumptions = { ...DEFAULT_ASSUMPTIONS };
  return currentAssumptions;
}
