use anyhow::{Result, anyhow, Context};
use ethabi::ethereum_types::U256;
use seda_sdk_rs::{
    Process,
    elog,
    http_fetch,
    log,
    http::{HttpFetchMethod, HttpFetchOptions},
    bytes::ToBytes,
};
use serde::Deserialize;
use serde_json::json;

const RPC_URL: &str =
    "https://cronos.blockpi.network/v1/rpc/0467a344ecda6f87cc7118bd02a14f5818a2f5ff";

const SELECTOR_GET_RESERVES: &str = "0902f1ac";
const SELECTOR_TOKEN0: &str = "0dfe1681";

const WCRO_ADDRESS: &str = "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
const USDC_ADDRESS: &str = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";
const WCRO_USDC_PAIR: &str = "0xE61Db569E231B3f5530168Aa2C9D50246525b6d6";

const SCALE: u128 = 1_000_000;
const BLOCKS_24H_ESTIMATE: u64 = 17_280;
const LIQUIDITY_TARGET_USDC_1E6: u128 = 500_000_000_000;
const LIQUIDITY_WARN_SCORE: u128 = 200_000;
const CONFIDENCE_WARN_SCORE: u128 = 200_000;
const DIVERGENCE_WARN_1E6: u128 = 50_000;
const SLIPPAGE_LIMIT_1E6: u128 = 10_000;
const TARGET_PAIR: &str = "WCRO-USDC";

pub fn execution_phase() -> Result<()> {
    if let Err(err) = execution_phase_inner() {
        elog!("Execution error: {err}");
        Process::error(format!("Execution error: {err}").as_bytes());
    }

    Ok(())
}

fn execution_phase_inner() -> Result<()> {
    let input = String::from_utf8(Process::get_inputs())?;
    let pair = parse_input_pair(&input)?;
    log!("Requested pair: {pair}");

    let pair_config = PairConfig {
        pair: WCRO_USDC_PAIR,
        base: WCRO_ADDRESS,
        quote: USDC_ADDRESS,
        base_decimals: 18,
        quote_decimals: 6,
    };

    let token0_result = rpc_call(pair_config.pair, SELECTOR_TOKEN0, None)?;
    let token0 = parse_address_from_32byte(&token0_result)
        .ok_or_else(|| anyhow!("Failed to parse token0 address"))?;

    let latest_block = rpc_get_block_number()?;
    let block_24h = latest_block.saturating_sub(BLOCKS_24H_ESTIMATE);
    let latest_reserves = get_reserves(pair_config.pair, Some(latest_block))?;
    let spot_now = price_from_reserves(&pair_config, &token0, &latest_reserves)?;

    let reserves_24h = get_reserves(pair_config.pair, Some(block_24h))?;
    let price_24h = price_from_reserves(&pair_config, &token0, &reserves_24h)?;

    let fair_price = (spot_now.saturating_mul(2) + price_24h) / 3;

    let liquidity_score = liquidity_score(latest_reserves.quote_reserve(&token0, &pair_config)?)?;
    let delta_1e6 = ratio_scaled_u128(abs_diff_u128(spot_now, price_24h), spot_now)?;
    let time_score = temporal_score(delta_1e6);
    let confidence_score = (U256::from(600_000u128) * U256::from(liquidity_score)
        + U256::from(400_000u128) * U256::from(time_score))
        / U256::from(SCALE);
    let confidence_score = confidence_score.as_u128();

    let max_safe_execution_size = max_safe_execution_size(
        latest_reserves.quote_reserve(&token0, &pair_config)?,
        latest_reserves.base_reserve(&token0, &pair_config)?,
        spot_now,
    )?;

    let flags = build_flags(delta_1e6, liquidity_score, confidence_score);

    let values = vec![
        U256::from(fair_price),
        U256::from(confidence_score),
        U256::from(max_safe_execution_size),
        U256::from(flags),
    ];

    let encoded = ethabi::encode(&[ethabi::Token::Array(
        values
            .into_iter()
            .map(ethabi::Token::Int)
            .collect(),
    )]);

    log!(
        "fair_price: {fair_price}, confidence: {confidence_score}, max_size: {max_safe_execution_size}, flags: {flags}"
    );
    Process::success(&encoded);
}

#[derive(Deserialize)]
struct OracleInput {
    pair: Option<String>,
}

struct PairConfig {
    pair: &'static str,
    base: &'static str,
    quote: &'static str,
    base_decimals: u8,
    quote_decimals: u8,
}

fn parse_input_pair(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Missing input: pair required"));
    }

    let parsed: OracleInput = serde_json::from_str(trimmed)?;
    let pair = parsed
        .pair
        .context("Missing pair in input")?
        .to_uppercase();

    if pair.as_str() != TARGET_PAIR {
        return Err(anyhow!("Unsupported pair: {pair}"));
    }

    Ok(pair)
}

struct Reserves {
    reserve0: U256,
    reserve1: U256,
}

impl Reserves {
    fn quote_reserve(&self, token0: &str, config: &PairConfig) -> Result<U256> {
        if token0.eq_ignore_ascii_case(config.base) {
            Ok(self.reserve1)
        } else if token0.eq_ignore_ascii_case(config.quote) {
            Ok(self.reserve0)
        } else {
            Err(anyhow!("token0 mismatch for pair"))
        }
    }

    fn base_reserve(&self, token0: &str, config: &PairConfig) -> Result<U256> {
        if token0.eq_ignore_ascii_case(config.base) {
            Ok(self.reserve0)
        } else if token0.eq_ignore_ascii_case(config.quote) {
            Ok(self.reserve1)
        } else {
            Err(anyhow!("token0 mismatch for pair"))
        }
    }
}

fn price_from_reserves(config: &PairConfig, token0: &str, reserves: &Reserves) -> Result<u128> {
    let (base_reserve, quote_reserve) = if token0.eq_ignore_ascii_case(config.base) {
        (reserves.reserve0, reserves.reserve1)
    } else if token0.eq_ignore_ascii_case(config.quote) {
        (reserves.reserve1, reserves.reserve0)
    } else {
        return Err(anyhow!("token0 mismatch for pair"));
    };

    if base_reserve.is_zero() {
        return Err(anyhow!("Base reserve is zero"));
    }

    let scale = pow10_u256(config.base_decimals as u32);
    let quote_scale = pow10_u256(config.quote_decimals as u32);
    let numerator = quote_reserve
        .saturating_mul(scale)
        .saturating_mul(U256::from(SCALE));
    let denominator = base_reserve.saturating_mul(quote_scale);
    let price_scaled = numerator / denominator;

    u256_to_u128(price_scaled)
}

fn get_reserves(pair: &str, block_number: Option<u64>) -> Result<Reserves> {
    let reserves_result = rpc_call(pair, SELECTOR_GET_RESERVES, block_number)?;
    let reserves_bytes = hex_to_bytes(&reserves_result)
        .ok_or_else(|| anyhow!("Failed to parse reserves hex"))?;
    if reserves_bytes.len() < 96 {
        return Err(anyhow!("Reserves result too short"));
    }

    let reserve0 = u256_from_be_slice(&reserves_bytes[0..32]);
    let reserve1 = u256_from_be_slice(&reserves_bytes[32..64]);
    Ok(Reserves { reserve0, reserve1 })
}

fn rpc_call(to: &str, data: &str, block_number: Option<u64>) -> Result<String> {
    let block_tag = block_number
        .map(|number| format!("0x{number:x}"))
        .unwrap_or_else(|| "latest".to_string());

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {
                "to": to,
                "data": format!("0x{data}"),
            },
            block_tag
        ]
    });

    let json_value = rpc_request(body)?;
    if let Some(error) = json_value.get("error") {
        return Err(anyhow!("RPC error: {error}"));
    }
    let result = json_value
        .get("result")
        .and_then(|value| value.as_str())
        .ok_or_else(|| anyhow!("RPC response missing result"))?;

    Ok(result.to_string())
}

fn rpc_request(body: serde_json::Value) -> Result<serde_json::Value> {
    let body_bytes = serde_json::to_vec(&body)?;
    let mut headers = std::collections::BTreeMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    let options = HttpFetchOptions {
        method: HttpFetchMethod::Post,
        headers,
        body: Some(body_bytes.to_bytes()),
        timeout_ms: Some(10_000),
    };

    let response = http_fetch(RPC_URL.to_string(), Some(options));
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        return Err(anyhow!("RPC request failed"));
    }

    let json_value: serde_json::Value = serde_json::from_slice(&response.bytes)?;
    Ok(json_value)
}

fn rpc_get_block_number() -> Result<u64> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_blockNumber",
        "params": []
    });
    let json_value = rpc_request(body)?;
    let result = json_value
        .get("result")
        .and_then(|value| value.as_str())
        .ok_or_else(|| anyhow!("RPC response missing block number"))?;
    u64::from_str_radix(result.trim_start_matches("0x"), 16)
        .map_err(|_| anyhow!("Invalid block number"))
}


fn parse_address_from_32byte(value: &str) -> Option<String> {
    let cleaned = value.strip_prefix("0x").unwrap_or(value);
    if cleaned.len() != 64 {
        return None;
    }
    let address = &cleaned[24..];
    Some(format!("0x{address}"))
}

fn hex_to_bytes(value: &str) -> Option<Vec<u8>> {
    let cleaned = value.strip_prefix("0x").unwrap_or(value);
    if cleaned.len() % 2 != 0 {
        return None;
    }
    (0..cleaned.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&cleaned[i..i + 2], 16).ok())
        .collect()
}

fn u256_from_be_slice(slice: &[u8]) -> U256 {
    let mut padded = [0u8; 32];
    let start = 32usize.saturating_sub(slice.len());
    padded[start..].copy_from_slice(slice);
    U256::from_big_endian(&padded)
}

fn pow10_u256(exp: u32) -> U256 {
    let mut value = U256::one();
    for _ in 0..exp {
        value = value.saturating_mul(U256::from(10u8));
    }
    value
}

fn u256_to_u128(value: U256) -> Result<u128> {
    if value > U256::from(u128::MAX) {
        return Err(anyhow!("Value exceeds u128 range"));
    }
    Ok(value.as_u128())
}

fn abs_diff_u128(a: u128, b: u128) -> u128 {
    if a >= b {
        a - b
    } else {
        b - a
    }
}

fn ratio_scaled_u128(numerator: u128, denominator: u128) -> Result<u128> {
    if denominator == 0 {
        return Err(anyhow!("Division by zero"));
    }
    let value = (U256::from(numerator) * U256::from(SCALE)) / U256::from(denominator);
    Ok(std::cmp::min(value.as_u128(), SCALE))
}

fn liquidity_score(quote_reserve: U256) -> Result<u128> {
    let target = U256::from(LIQUIDITY_TARGET_USDC_1E6);
    if quote_reserve >= target {
        return Ok(SCALE);
    }
    let score = (quote_reserve * U256::from(SCALE)) / target;
    Ok(score.as_u128())
}

fn temporal_score(delta_1e6: u128) -> u128 {
    if delta_1e6 >= DIVERGENCE_WARN_1E6 {
        return 0;
    }
    let penalty = (U256::from(delta_1e6) * U256::from(SCALE)) / U256::from(DIVERGENCE_WARN_1E6);
    let score = U256::from(SCALE).saturating_sub(penalty);
    score.as_u128()
}

fn max_safe_execution_size(
    reserve_in: U256,
    reserve_out: U256,
    spot_1e6: u128,
) -> Result<u128> {
    if reserve_in.is_zero() || reserve_out.is_zero() {
        return Err(anyhow!("Reserves are zero"));
    }

    let mut low = U256::zero();
    let mut high = reserve_in / U256::from(2u8);
    let mut best = U256::zero();

    for _ in 0..28 {
        let mid = (low + high) / U256::from(2u8);
        if mid.is_zero() {
            break;
        }
        let amount_out = amm_amount_out(mid, reserve_in, reserve_out)?;
        if amount_out.is_zero() {
            high = mid.saturating_sub(U256::from(1u8));
            continue;
        }

        let effective_price = (mid * U256::from(1_000_000_000_000_000_000u128))
            / amount_out;
        let effective_price_u128 = u256_to_u128(effective_price)?;
        let slippage = ratio_scaled_u128(
            abs_diff_u128(effective_price_u128, spot_1e6),
            spot_1e6,
        )?;
        if slippage < SLIPPAGE_LIMIT_1E6 {
            best = mid;
            low = mid + U256::from(1u8);
        } else {
            high = mid.saturating_sub(U256::from(1u8));
        }
    }

    u256_to_u128(best)
}

fn amm_amount_out(amount_in: U256, reserve_in: U256, reserve_out: U256) -> Result<U256> {
    let amount_in_with_fee = amount_in * U256::from(997u16);
    let numerator = amount_in_with_fee * reserve_out;
    let denominator = reserve_in * U256::from(1000u16) + amount_in_with_fee;
    if denominator.is_zero() {
        return Err(anyhow!("AMM denominator is zero"));
    }
    Ok(numerator / denominator)
}

fn build_flags(delta_1e6: u128, liquidity_score: u128, confidence_score: u128) -> u128 {
    let mut flags = 0u128;
    if delta_1e6 > DIVERGENCE_WARN_1E6 {
        flags |= 1;
    }
    if liquidity_score < LIQUIDITY_WARN_SCORE {
        flags |= 2;
    }
    if confidence_score < CONFIDENCE_WARN_SCORE {
        flags |= 4;
    }
    flags
}
