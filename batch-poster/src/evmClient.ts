import { Contract, JsonRpcProvider, Wallet } from 'ethers';

import type { Batch, Result, ValidatorProof } from './sedaClient.js';

export type EvmClientConfig = {
  rpcUrl: string;
  privateKey: string;
  proverAddress: string;
  coreAddress: string;
};

const proverAbi = [
  'function getLastBatchHeight() view returns (uint64)',
  'function postBatch((uint64 batchHeight,uint64 blockHeight,bytes32 validatorsRoot,bytes32 resultsRoot,bytes32 provingMetadata) newBatch, bytes[] signatures, (uint32 votingPower,address signer,bytes32[] merkleProof)[] validatorProofs)',
];

const coreAbi = [
  'function postResult((bytes32 drId,uint128 gasUsed,uint64 blockHeight,uint64 blockTimestamp,bool consensus,uint8 exitCode,string version,bytes result,bytes paybackAddress,bytes sedaPayload) result,uint64 batchHeight,bytes32[] proof) returns (bytes32)',
  'function getResult(bytes32 requestId) view returns (bytes32 drId,uint128 gasUsed,uint64 blockHeight,uint64 blockTimestamp,bool consensus,uint8 exitCode,string version,bytes result,bytes paybackAddress,bytes sedaPayload)',
];

export class EvmClient {
  readonly provider: JsonRpcProvider;
  readonly signer: Wallet;
  readonly prover: Contract;
  readonly core: Contract;

  constructor(config: EvmClientConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.signer = new Wallet(config.privateKey, this.provider);
    this.prover = new Contract(config.proverAddress, proverAbi, this.signer);
    this.core = new Contract(config.coreAddress, coreAbi, this.signer);
  }

  async getLastBatchHeight(): Promise<bigint> {
    return (await this.prover.getLastBatchHeight()) as bigint;
  }

  async postBatch(batch: Batch, signatures: string[], validatorProofs: ValidatorProof[]) {
    const tx = await this.prover.postBatch(
      {
        batchHeight: batch.batchHeight,
        blockHeight: batch.blockHeight,
        validatorsRoot: normalizeHex(batch.validatorsRoot),
        resultsRoot: normalizeHex(batch.resultsRoot),
        provingMetadata: normalizeHex(batch.provingMetadata),
      },
      signatures.map(normalizeHex),
      validatorProofs.map((proof) => ({
        votingPower: proof.votingPower,
        signer: proof.signer,
        merkleProof: proof.merkleProof.map(normalizeHex),
      })),
    );
    return tx;
  }

  async postResult(result: Result, batchHeight: bigint, merkleProof: string[]) {
    const tx = await this.core.postResult(
      {
        drId: normalizeHex(result.drId),
        gasUsed: result.gasUsed,
        blockHeight: result.blockHeight,
        blockTimestamp: result.blockTimestamp,
        consensus: result.consensus,
        exitCode: result.exitCode,
        version: result.version,
        result: normalizeHex(result.result),
        paybackAddress: normalizeHex(result.paybackAddress),
        sedaPayload: normalizeHex(result.sedaPayload),
      },
      batchHeight,
      merkleProof.map(normalizeHex),
    );
    return tx;
  }

  async getResult(requestId: string) {
    return this.core.getResult(normalizeHex(requestId));
  }
}

function normalizeHex(value: string): string {
  if (!value) return value;
  return value.startsWith('0x') ? value : `0x${value}`;
}
