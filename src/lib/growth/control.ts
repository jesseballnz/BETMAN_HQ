import { readFile } from 'node:fs/promises';

export type GrowthOperatingMode = 'watch' | 'live';

export interface GrowthControlState {
  schemaVersion: 1;
  mode: GrowthOperatingMode;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_CONTROL: GrowthControlState = {
  schemaVersion: 1,
  mode: 'watch',
  updatedAt: null,
  updatedBy: null,
};

export function growthControlPath(): string {
  return process.env.BETMAN_GROWTH_CONTROL
    || '/opt/betman/betman_hq/runtime/growth-agent/control.json';
}

export async function readGrowthControl(): Promise<GrowthControlState> {
  try {
    const parsed = JSON.parse(await readFile(growthControlPath(), 'utf8')) as Partial<GrowthControlState>;
    if (parsed.schemaVersion !== 1 || (parsed.mode !== 'watch' && parsed.mode !== 'live')) {
      return DEFAULT_CONTROL;
    }
    return {
      schemaVersion: 1,
      mode: parsed.mode,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
    };
  } catch {
    return DEFAULT_CONTROL;
  }
}
