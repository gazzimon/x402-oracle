import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ethers } from 'ethers';
import { Facilitator, CronosNetwork, PaymentRequirements } from '@crypto.com/facilitator-client';
import { handleX402Payment } from '../lib/middlewares/require.middleware.js';

const NETWORK = (process.env.NETWORK ?? 'cronos-testnet') as CronosNetwork;
const CRONOS_RPC_URL = process.env.CRONOS_RPC_URL ?? '';
const CONSUMER_ADDRESS = process.env.CONSUMER_ADDRESS ?? '';
const SEDA_EXPLORER_BASE = process.env.SEDA_EXPLORER_BASE ?? 'https://testnet.explorer.seda.xyz';
const RELAYER_STATE_PATH =
  process.env.RELAYER_STATE_PATH ??
  path.resolve(process.cwd(), '../../seda-starter-kit/relayer/.relayer-state.json');
const SEDA_STARTER_KIT_PATH =
  process.env.SEDA_STARTER_KIT_PATH ?? path.resolve(process.cwd(), '../../seda-starter-kit');

const consumerAbi = [
  'function getLatest(bytes32) view returns (int256[4])',
  'function getLatestRequestId(bytes32) view returns (bytes32)',
];

type RelayerState = {
  lastByPair?: Record<
    string,
    {
      requestId?: string;
      drBlockHeight?: number;
      txHash?: string;
      updatedAt?: string;
    }
  >;
};

function loadRelayerState(): RelayerState {
  if (!fs.existsSync(RELAYER_STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(RELAYER_STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function extractPairFromRequirements(paymentRequirements: PaymentRequirements): string | null {
  const resource = (paymentRequirements as { resource?: string }).resource;
  if (!resource) return null;
  try {
    const url = new URL(resource, 'http://localhost');
    const pair = url.searchParams.get('pair');
    return pair ? pair.toUpperCase() : null;
  } catch {
    return null;
  }
}

function runPostDrRelay(pair: string): Promise<void> {
  const env = { ...process.env, EXEC_INPUTS: JSON.stringify({ pair }) };
  return new Promise((resolve, reject) => {
    console.info('[x402] post-dr-relay start', {
      pair,
      cwd: SEDA_STARTER_KIT_PATH,
      execInputs: env.EXEC_INPUTS,
      relayerStatePath: RELAYER_STATE_PATH,
    });
    const proc = spawn('bun', ['run', 'post-dr-relay'], {
      cwd: SEDA_STARTER_KIT_PATH,
      env,
      stdio: 'inherit',
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      console.info('[x402] post-dr-relay exit', { pair, code });
      if (code === 0) resolve();
      else reject(new Error(`post-dr-relay failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

function formatScaled(value: bigint, decimals: number): string {
  const base = BigInt(10 ** decimals);
  const integer = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0');
  return `${integer.toString()}.${fraction}`;
}

/**
 * Service layer for entitlement-gated resources and X402 payment settlement.
 *
 * Responsibilities:
 * - Configure and manage the Facilitator SDK client.
 * - Settle X402 payments and store resulting entitlements.
 * - Produce payloads for entitled (paid) resources.
 *
 * @remarks
 * The Cronos network is resolved from `process.env.NETWORK` and defaults to
 * `"cronos-testnet"`. Ensure this value matches a supported
 * {@link CronosNetwork} at runtime.
 */
export class ResourceService {
  /**
   * Facilitator SDK client configured for the selected Cronos network.
   *
   * @privateRemarks
   * Instantiated eagerly. For improved testability, this may be injected
   * via the constructor instead.
   */
  private facilitator = new Facilitator({ network: NETWORK });
  private provider: ethers.JsonRpcProvider | null = null;
  private consumer: ethers.Contract | null = null;

  private getConsumer(): ethers.Contract {
    if (!CRONOS_RPC_URL || !CONSUMER_ADDRESS) {
      throw new Error('Missing CRONOS_RPC_URL or CONSUMER_ADDRESS');
    }
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
    }
    if (!this.consumer) {
      this.consumer = new ethers.Contract(CONSUMER_ADDRESS, consumerAbi, this.provider);
    }
    return this.consumer;
  }

  /**
   * Returns the payload for an entitled user.
   *
   * This method does not perform entitlement checks itself; it assumes
   * payment verification has already been completed upstream.
   *
   * @returns An object representing the unlocked/paid content response.
   */
  async getSecretPayload(pair: string) {
    const consumer = this.getConsumer();
    const pairKey = ethers.keccak256(ethers.toUtf8Bytes(pair));
    const [values, requestIdOnChain] = await Promise.all([
      consumer.getLatest(pairKey),
      consumer.getLatestRequestId(pairKey),
    ]);

    const parsedValues = (values as bigint[]).map((value) => BigInt(value.toString()));
    const [fairPrice, confidence, maxSize, flags] = parsedValues;
    const state = loadRelayerState();
    const meta = state.lastByPair?.[pair];
    const drId = meta?.requestId ?? stripHexPrefix(requestIdOnChain?.toString?.() ?? '');
    const drBlockHeight = meta?.drBlockHeight ?? null;
    const sedaExplorerUrl =
      drId && drBlockHeight
        ? `${SEDA_EXPLORER_BASE}/data-requests/${drId}/${drBlockHeight}`
        : null;

    return {
      ok: true,
      pair,
      fairPriceScaled: fairPrice.toString(),
      fairPrice: formatScaled(fairPrice, 6),
      confidenceScoreScaled: confidence.toString(),
      confidenceScore: formatScaled(confidence, 6),
      maxSafeExecutionSizeScaled: maxSize.toString(),
      maxSafeExecutionSize: formatScaled(maxSize, 6),
      flags: flags.toString(),
      decimals: 6,
      sedaExplorerUrl,
      sedaRequestId: drId || null,
      cronosTxHash: meta?.txHash ?? null,
      relayedAt: meta?.updatedAt ?? null,
    };
  }

  /**
   * Settles an X402 payment using the Facilitator SDK.
   *
   * This delegates verification and settlement to the shared
   * {@link handleX402Payment} helper.
   *
   * @param params - Payment settlement parameters.
   * @param params.paymentId - Unique identifier for the payment.
   * @param params.paymentHeader - Encoded payment header provided by the client.
   * @param params.paymentRequirements - Requirements returned by a prior 402 challenge.
   * @returns The settlement result as returned by {@link handleX402Payment}.
   * @throws Re-throws any error raised by the underlying settlement helper or SDK.
   */
  async settlePayment(params: { paymentId: string; paymentHeader: string; paymentRequirements: PaymentRequirements }) {
    console.info('[x402] settlePayment start', {
      paymentId: params.paymentId,
      resource: (params.paymentRequirements as { resource?: string }).resource,
    });
    const result = await handleX402Payment({
      facilitator: this.facilitator,
      paymentId: params.paymentId,
      paymentHeader: params.paymentHeader,
      paymentRequirements: params.paymentRequirements,
    });
    console.info('[x402] settlePayment result', { ok: result.ok, paymentId: params.paymentId });
    if (result.ok) {
      const pair = extractPairFromRequirements(params.paymentRequirements);
      console.info('[x402] derived pair', { pair });
      if (pair) {
        await runPostDrRelay(pair);
      }
    }
    return result;
  }
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}
