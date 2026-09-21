import { readFile } from 'node:fs/promises';
import type { GrowthSnapshot } from './types';

export async function readGrowthSnapshot(): Promise<GrowthSnapshot | null> {
  const file = process.env.BETMAN_GROWTH_STATUS
    || '/opt/betman/betman_hq/runtime/growth-agent/latest.json';
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as GrowthSnapshot;
    return parsed?.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}
