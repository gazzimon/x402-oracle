import { ethers } from 'ethers';

const RPC_URL = process.env.CRONOS_RPC_URL ?? '';
const CONSUMER_ADDRESS = process.env.ORACLE_CONSUMER_ADDRESS ?? '';

const ORACLE_ABI = [
  'function getPrice(bytes32 pair) view returns (uint256)',
  'function lastUpdate(bytes32 pair) view returns (uint256)',
];

const EDGE_ROUTES: Record<string, { direct: string; synthetic: [string, string] }> = {
  'WBTC-WCRO': { direct: 'WBTC-WCRO', synthetic: ['WBTC-USDC', 'WCRO-USDC'] },
};

export class OracleService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    if (!RPC_URL || !CONSUMER_ADDRESS) {
      throw new Error('Missing CRONOS_RPC_URL or ORACLE_CONSUMER_ADDRESS');
    }
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(CONSUMER_ADDRESS, ORACLE_ABI, this.provider);
  }

  async getPrice(pair: string): Promise<{ pair: string; value: bigint; updatedAt: bigint }> {
    const pairKey = this.pairKey(pair);
    const value = (await this.contract.getPrice(pairKey)) as bigint;
    const updatedAt = (await this.contract.lastUpdate(pairKey)) as bigint;
    return { pair, value, updatedAt };
  }

  async getEdge(pair: string): Promise<{ pair: string; edge: bigint; direct: bigint; synthetic: bigint }> {
    const route = EDGE_ROUTES[pair];
    if (!route) {
      throw new Error(`Unsupported edge pair: ${pair}`);
    }

    const direct = (await this.contract.getPrice(this.pairKey(route.direct))) as bigint;
    const legA = (await this.contract.getPrice(this.pairKey(route.synthetic[0]))) as bigint;
    const legB = (await this.contract.getPrice(this.pairKey(route.synthetic[1]))) as bigint;

    if (legA === 0n || legB === 0n) {
      throw new Error('Synthetic legs not available');
    }

    const synthetic = (legA * 100000000n) / legB;
    if (synthetic === 0n) {
      throw new Error('Synthetic price is zero');
    }

    const edge = ((direct - synthetic) * 100000000n) / synthetic;
    return { pair, edge, direct, synthetic };
  }

  private pairKey(pair: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(pair));
  }
}
