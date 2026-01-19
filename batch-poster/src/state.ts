import fs from 'node:fs';

export type PosterState = {
  lastPostedBatchHeight: number;
  lastResultBatchHeight: number;
  postedResultIds: Record<string, boolean>;
};

const DEFAULT_STATE: PosterState = {
  lastPostedBatchHeight: 0,
  lastResultBatchHeight: 0,
  postedResultIds: {},
};

export function loadState(path: string): PosterState {
  if (!fs.existsSync(path)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PosterState>;
    return {
      lastPostedBatchHeight: parsed.lastPostedBatchHeight ?? 0,
      lastResultBatchHeight: parsed.lastResultBatchHeight ?? 0,
      postedResultIds: parsed.postedResultIds ?? {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(path: string, state: PosterState) {
  fs.writeFileSync(path, JSON.stringify(state, null, 2));
}
