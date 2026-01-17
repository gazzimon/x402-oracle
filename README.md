Programmable Oracle Primitive for Cronos
Enabling Execution-Grade Data and Agentic Finance
1. Architecture: Settlement, Computation, and Monetization

This project redefines the role of oracles in the Cronos DeFi ecosystem through a three-layer architecture:

Settlement Layer – Cronos
Cronos is the gravity center where capital lives and moves. All DeFi execution—VVS swaps, liquidity provision, and lending—happens here. Cronos also acts as the final settlement layer for oracle payments and downstream execution.

Computation Layer – SEDA
SEDA provides decentralized, chain-agnostic computation that transforms raw data into high-fidelity metrics. Unlike traditional push-based oracles, SEDA enables programmable logic, allowing complex calculations and validation to occur before data is delivered.

Monetization Layer – x402
x402 introduces a pay-per-request standard based on HTTP 402. It turns data access into an on-chain economic transaction, eliminating dependency on protocol subsidies and enabling a sustainable oracle business model from day one.

2. The Problem: From Price Feeds to Execution-Grade Metrics

Traditional oracles deliver spot prices or simple TWAPs. These signals are vulnerable to manipulation—especially via flash loans—and lack the contextual information required for safe automated execution.

Autonomous agents and DeFi protocols do not need raw prices.
They need decisions.

Our solution delivers:

Programmable Fair Value
Manipulation-resistant valuation of LP tokens using programmable logic inspired by established asset-pricing research, customizable per pool and risk profile.

Actionable Pool Health Metrics
Instead of a single number, the oracle outputs a multidimensional, execution-ready payload:

{
  "fair_price": 1.0234,
  "confidence_score": 0.98,
  "max_safe_execution_size": 150000,
  "volatility_alert": false
}


This allows a smart contract or an AI agent to instantly determine whether an action is safe to execute.

3. Oracle-as-a-Service: Seamless Delivery and Composability

The system is designed for maximum composability within Cronos:

Request
An AI agent or DeFi protocol requests a specific metric through an x402-protected endpoint.

Payment
Payment is automatically settled on Cronos, ensuring economic sustainability per request.

Computation
SEDA executes the decentralized logic and produces a verified result.

Delivery
The output is delivered in two forms:

On-chain consumers: direct input to smart contracts (e.g., LP collateral checks in lending).

Verifiable payloads: for off-chain agents that require cryptographic proof before executing complex strategies.

4. Strategic Vision: Enabling Agentic Finance on Cronos

This project is not just an oracle feed—it is the circulatory system for Agentic Finance on Cronos.

By creating a marketplace for paid, verifiable, execution-grade DeFi metrics, we enable:

Sustainability: oracle revenue is driven by real usage, not subsidies.

Security: reduced systemic risk for protocols accepting LP tokens as collateral.

Autonomy: a new generation of AI agents that operate profitably and safely, paying only for the high-quality intelligence they need to move capital.
- **httpx**
- **OpenAI API**

## License

This project is licensed under the **MIT License**.

## Output Format (Canonical)

On-chain output is a fixed `int256[4]` array with **1e6 scale**:

```
values[0] = fair_price (1e6)
values[1] = confidence_score (1e6)
values[2] = max_safe_execution_size (1e6)
values[3] = flags (bitmask)
```

## Output Formulas (WCRO-USDC)

Pool (VVS V2): `0xE61Db569E231B3f5530168Aa2C9D50246525b6d6`

Let `reserveUSDC` and `reserveWCRO` be the normalized reserves (USDC 6 decimals, WCRO 18):

```
spot_1e6 = (reserveUSDC_now * 1e18) / reserveWCRO_now
hist_1e6 = (reserveUSDC_hist * 1e18) / reserveWCRO_hist
```

Fair price (weighted):

```
fair_price_1e6 = (2 * spot_1e6 + hist_1e6) / 3
```

Liquidity score (1e6):

```
liquidity_usdc = reserveUSDC_now * 2
L = 500_000 * 1e6
liq_score_1e6 = min(1e6, (liquidity_usdc * 1e6) / L)
```

Temporal score (1e6):

```
delta_1e6 = (abs(spot_1e6 - hist_1e6) * 1e6) / spot_1e6
time_score_1e6 = clamp(1e6 - (delta_1e6 * 1e6) / 50_000, 0, 1e6)
```

Confidence (60/40):

```
confidence_1e6 = (600_000 * liq_score_1e6 + 400_000 * time_score_1e6) / 1_000_000
```

Max safe execution size (1e6, USDC input) with AMM V2 formula:

```
amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
effective_price_1e6 = (amountIn * 1e18) / amountOut
slippage_1e6 = (abs(effective_price_1e6 - spot_1e6) * 1e6) / spot_1e6
```

Find max `amountIn` such that `slippage_1e6 < 10_000` via bisection.

## Flags (values[3])

- `bit0 (0x1)`: CRITICAL_DIVERGENCE if `delta_1e6 > 50_000` (5%)
- `bit1 (0x2)`: LOW_LIQUIDITY if `liq_score_1e6 < 200_000`
- `bit2 (0x4)`: UNSAFE_CONFIDENCE if `confidence_1e6 < 200_000`

## Validation Checklist (Testnet)

- Oracle Program ID (SEDA): `0x61d26d8e7693b39a4296e1ecba45595bc7cdbbeecb1043c7034c8f99498f1504`
- DR ID (SEDA): `ba65b51684c798468ef9282cf245d96d45942beeec73a0b73c5c607ca768ed15`
- DR Explorer Link: `https://testnet.explorer.seda.xyz/data-requests/ba65b51684c798468ef9282cf245d96d45942beeec73a0b73c5c607ca768ed15/7299903`
- Cronos Consumer: `0xe0F946B25e4cce13FeF052cc76573fA8dF74D9D9`
- Relayer TX (Cronos testnet): `0x383aaf3d2ac7b36a4702fd62cd63db74405713fe9991a501b6b934c965748576`
- Cronos Explorer Link: `https://testnet.cronoscan.com/tx/0x383aaf3d2ac7b36a4702fd62cd63db74405713fe9991a501b6b934c965748576`

Observed values (1e6 scale):

- `values[0] = 102308` → `0.102308` (fair_price)
- `values[1] = 943288` → `0.943288` (confidence_score)
- `values[2] = 26581068577` → `26581.068577` (max_safe_execution_size)
- `values[3] = 0` (flags)
