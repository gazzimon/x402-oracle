export type Batch = {
  batchHeight: bigint;
  blockHeight: bigint;
  validatorsRoot: string;
  resultsRoot: string;
  provingMetadata: string;
};

export type ValidatorProof = {
  votingPower: number;
  signer: string;
  merkleProof: string[];
};

export type Result = {
  drId: string;
  gasUsed: bigint;
  blockHeight: bigint;
  blockTimestamp: bigint;
  consensus: boolean;
  exitCode: number;
  version: string;
  result: string;
  paybackAddress: string;
  sedaPayload: string;
};

export type FinalizedResult = {
  resultId: string;
  batchHeight: bigint;
  result: Result;
  merkleProof: string[];
};

export type SedaClientOptions = {
  apiUrl?: string;
};

export class SedaClient {
  private readonly apiUrl?: string;

  constructor(options: SedaClientOptions) {
    this.apiUrl = options.apiUrl;
  }

  async getLatestFinalizedBatchHeight(): Promise<bigint> {
    throw new Error(
      'TODO: implement getLatestFinalizedBatchHeight(). Provide a trusted SEDA endpoint that exposes finalized batches.',
    );
  }

  async getBatch(_height: bigint): Promise<Batch> {
    throw new Error(
      'TODO: implement getBatch(height). Must return SedaDataTypes.Batch fields sourced from SEDA.',
    );
  }

  async getBatchSignatures(
    _height: bigint,
  ): Promise<{ signatures: string[]; validatorProofs: ValidatorProof[] }> {
    throw new Error(
      'TODO: implement getBatchSignatures(height). Must fetch validator signatures + proofs from an official SEDA source.',
    );
  }

  async getResultInclusionProof(
    _resultId: string,
    _batchHeight: bigint,
  ): Promise<string[]> {
    throw new Error(
      'TODO: implement getResultInclusionProof(resultId, batchHeight). Must return the merkle proof from SEDA.',
    );
  }

  async getFinalizedResults(_fromBatchHeight?: bigint): Promise<FinalizedResult[]> {
    throw new Error(
      'TODO: implement getFinalizedResults(fromBatchHeight). Must return finalized results with batchHeight + merkle proof.',
    );
  }
}
