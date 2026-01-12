import { describe, expect, it } from 'bun:test';
import { createSuccessfulJsonBigIntArrayReveal, createSuccessfulJsonBigIntReveal } from './utils.js';

describe('create successful reveal', () => {
  it('uint256 array should encode a reveal with two values', () => {
    const buffer = Buffer.from([
      91, 49, 49, 56, 48, 53, 55, 48, 48, 48, 48, 48, 48, 44, 51, 55, 56, 51, 52, 48, 48, 48, 48, 48, 93,
    ]);
    const reveal = createSuccessfulJsonBigIntArrayReveal([118057000000n, 3783400000n]);

    expect(reveal.result).toEqual(buffer);
  });

  it('uint256 should encode a reveal with one value', () => {
    const buffer = Buffer.from('[100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]');
    const reveal = createSuccessfulJsonBigIntReveal(100n);

    expect(reveal.result).toEqual(buffer);
  });
});
