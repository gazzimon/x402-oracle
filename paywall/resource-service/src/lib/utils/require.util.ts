import 'dotenv/config';
import type { Request } from 'express';
import { CronosNetwork, Contract } from '@crypto.com/facilitator-client';
import { requireX402Payment } from '../middlewares/require.middleware.js';

const NETWORK = (process.env.NETWORK ?? 'cronos-testnet') as CronosNetwork;
const PAY_TO = process.env.MERCHANT_ADDRESS ?? '';
const ASSET = NETWORK === CronosNetwork.CronosMainnet ? Contract.USDCe : Contract.DevUSDCe;
const RESOURCE = process.env.PUBLIC_RESOURCE_URL ?? 'http://localhost:8787/api/data';
const PRICE = process.env.PRICE_BASE_UNITS ?? '1000000';

/**
 * Creates an Express middleware that enforces X402 payment for a protected resource.
 *
 * Responsibilities:
 * - Resolve payment configuration (network, payee, asset, price, resource).
 * - Configure and return the middleware produced by {@link requireX402Payment}.
 *
 * @remarks
 * Environment variables:
 * - `NETWORK` (optional): Cronos network identifier. Defaults to `"cronos-testnet"`.
 * - `MERCHANT_ADDRESS` (required): Address that receives payments.
 * - `PUBLIC_RESOURCE_URL` (optional): Canonical resource identifier. Defaults to `http://localhost:8787/api/secret`.
 * - `PRICE_BASE_UNITS` (optional): Price in base units. Defaults to `"1000000"`.
 *
 * Side effects:
 * - Loads environment variables via `dotenv/config`.
 * - Throws at module load time if `MERCHANT_ADDRESS` is not set.
 *
 * @param opts - Optional overrides for middleware configuration.
 * @param opts.description - Human-readable description of the protected resource.
 * @returns An Express-compatible middleware returned by {@link requireX402Payment}.
 */
export const requirePaidAccess = (opts?: { description?: string }) => {
  return requireX402Payment({
    network: NETWORK,
    payTo: PAY_TO,
    asset: ASSET,
    maxAmountRequired: PRICE,
    description: (req: Request) => {
      const pair = String(req.query.pair ?? '').trim().toUpperCase();
      return opts?.description ?? (pair ? `Unlock price for ${pair}` : 'Unlock resource');
    },
    resource: (req: Request) => {
      const pair = String(req.query.pair ?? '').trim().toUpperCase();
      const url = pair ? `${RESOURCE}?pair=${encodeURIComponent(pair)}` : RESOURCE;
      return url;
    },
    outputSchema: {
      input: { type: 'http', method: 'GET' },
      output: {
        type: 'object',
        fields: {
          pair: { type: 'string' },
          price: { type: 'string' },
          sedaExplorerUrl: { type: 'string' },
          cronosTxHash: { type: 'string' },
        },
      },
    },
  });
};

/**
 * Resolved X402 configuration values derived from environment variables.
 *
 * @remarks
 * This object is intended for diagnostics and downstream configuration.
 * Values are resolved at module load time.
 */
export const x402Config = { NETWORK, PAY_TO, ASSET, RESOURCE, PRICE };
