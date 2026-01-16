use anyhow::{Result, anyhow};
use ethabi::ethereum_types::U256;
use seda_sdk_rs::{
    Process,
    elog,
    http_fetch,
    log,
    http::{HttpFetchMethod, HttpFetchOptions},
    bytes::ToBytes,
};
use serde_json::json;

const DEFAULT_PAIR: &str = "WCRO-USDC";
const RPC_URL: &str =
    "https://mainnet-sticky.cronoslabs.com/v1/d3642384d334ff6ff1c4baebfdf3ef7d";

const SELECTOR_GET_RESERVES: &str = "0902f1ac";
const SELECTOR_SLOT0: &str = "3850c7bd";
const SELECTOR_TOKEN0: &str = "0dfe1681";

const WCRO_ADDRESS: &str = "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
const USDC_ADDRESS: &str = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";
const VVS_ADDRESS: &str = "0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03";
const WBTC_ADDRESS: &str = "0x062E66477Faf219F25D27dCED647BF57C3107d52";
const WETH_ADDRESS: &str = "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a";
const USDT_ADDRESS: &str = "0x66e428c3f67a68878562e79A0234c1F83c208770";

const WCRO_USDC_PAIR: &str = "0xE61Db569E231B3f5530168Aa2C9D50246525b6d6";
const VVS_WCRO_PAIR: &str = "0xBf62c67EA509E86F07c8C69d0286C0636c50270B";
const WBTC_WCRO_PAIR: &str = "0x8F09fff247B8FDb80461E5cf5E82dD1AE2ebd6d7";
const WCRO_ETH_PAIR: &str = "0xA111C17F8b8303280d3EB01BbCd61000AA7f39f9";
const USDT_USDC_V3_POOL: &str = "0x0438a75009519f6284fa9e050e54d940302b2e93";

fn parse_input_pair(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Ok(DEFAULT_PAIR.to_string());
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(pair) = value.get("pair").and_then(|v| v.as_str()) {
            return Ok(pair.to_string());
        }
        if let Some(pair) = value.as_str() {
            return Ok(pair.to_string());
        }
    }

    Ok(trimmed.to_string())
}

fn validate_pair(pair: &str) -> Result<String> {
    let pair = pair.to_uppercase();
    match pair.as_str() {
        "WCRO-USDC" | "VVS-WCRO" | "WBTC-WCRO" | "WCRO-ETH" | "USDT-USDC" => Ok(pair),
        _ => Err(anyhow!("Unsupported pair: {pair}")),
    }
}

pub fn execution_phase() -> Result<()> {
    let input = String::from_utf8(Process::get_inputs())?;
    let pair = validate_pair(&parse_input_pair(&input)?)?;

    let pair_config = match pair.as_str() {
        "WCRO-USDC" => PairConfig::v2(
            WCRO_USDC_PAIR,
            WCRO_ADDRESS,
            USDC_ADDRESS,
            18,
            6,
        ),
        "VVS-WCRO" => PairConfig::v2(
            VVS_WCRO_PAIR,
            VVS_ADDRESS,
            WCRO_ADDRESS,
            18,
            18,
        ),
        "WBTC-WCRO" => PairConfig::v2(
            WBTC_WCRO_PAIR,
            WBTC_ADDRESS,
            WCRO_ADDRESS,
            8,
            18,
        ),
        "WCRO-ETH" => PairConfig::v2(
            WCRO_ETH_PAIR,
            WCRO_ADDRESS,
            WETH_ADDRESS,
            18,
            18,
        ),
        "USDT-USDC" => PairConfig::v3(
            USDT_USDC_V3_POOL,
            USDT_ADDRESS,
            USDC_ADDRESS,
            6,
            6,
        ),
        _ => return Err(anyhow!("Unsupported pair: {pair}")),
    };

    let price_scaled = match pair_config {
        PairConfig::V2(config) => price_from_v2(&config)?,
        PairConfig::V3(config) => price_from_v3(&config)?,
    };

    log!("Computed price (scaled 1e6): {price_scaled}");
    // Scaled 1e6 u128, serialized little-endian for tally.
    Process::success(&price_scaled.to_le_bytes());

    Ok(())
}

struct V2Config {
    pair: &'static str,
    base: &'static str,
    quote: &'static str,
    base_decimals: u8,
    quote_decimals: u8,
}

struct V3Config {
    pool: &'static str,
    base: &'static str,
    quote: &'static str,
    base_decimals: u8,
    quote_decimals: u8,
}

enum PairConfig {
    V2(V2Config),
    V3(V3Config),
}

impl PairConfig {
    fn v2(
        pair: &'static str,
        base: &'static str,
        quote: &'static str,
        base_decimals: u8,
        quote_decimals: u8,
    ) -> Self {
        PairConfig::V2(V2Config {
            pair,
            base,
            quote,
            base_decimals,
            quote_decimals,
        })
    }

    fn v3(
        pool: &'static str,
        base: &'static str,
        quote: &'static str,
        base_decimals: u8,
        quote_decimals: u8,
    ) -> Self {
        PairConfig::V3(V3Config {
            pool,
            base,
            quote,
            base_decimals,
            quote_decimals,
        })
    }
}

fn price_from_v2(config: &V2Config) -> Result<u128> {
    let reserves_result = rpc_call(config.pair, SELECTOR_GET_RESERVES)?;
    let reserves_bytes = hex_to_bytes(&reserves_result)
        .ok_or_else(|| anyhow!("Failed to parse reserves hex"))?;
    if reserves_bytes.len() < 64 {
        return Err(anyhow!("Reserves result too short"));
    }

    let reserve0 = u256_from_be_slice(&reserves_bytes[0..32]);
    let reserve1 = u256_from_be_slice(&reserves_bytes[32..64]);

    let token0_result = rpc_call(config.pair, SELECTOR_TOKEN0)?;
    let token0 = parse_address_from_32byte(&token0_result)
        .ok_or_else(|| anyhow!("Failed to parse token0 address"))?;

    let base = config.base.to_lowercase();
    let quote = config.quote.to_lowercase();

    let (base_reserve, quote_reserve) = if token0.eq_ignore_ascii_case(&base) {
        (reserve0, reserve1)
    } else if token0.eq_ignore_ascii_case(&quote) {
        (reserve1, reserve0)
    } else {
        return Err(anyhow!("token0 mismatch for pair"));
    };

    if base_reserve.is_zero() {
        return Err(anyhow!("Base reserve is zero"));
    }

    // price_scaled = quote_reserve * 10^(base_decimals + 6) / (base_reserve * 10^quote_decimals)
    let scale = pow10_u256(config.base_decimals as u32 + 6);
    let quote_scale = pow10_u256(config.quote_decimals as u32);
    let numerator = quote_reserve.saturating_mul(scale);
    let denominator = base_reserve.saturating_mul(quote_scale);
    let price_scaled = numerator / denominator;

    Ok(u256_to_u128(price_scaled)?)
}

fn price_from_v3(config: &V3Config) -> Result<u128> {
    let slot0_result = rpc_call(config.pool, SELECTOR_SLOT0)?;
    let slot0_bytes = hex_to_bytes(&slot0_result)
        .ok_or_else(|| anyhow!("Failed to parse slot0 hex"))?;
    if slot0_bytes.len() < 32 {
        return Err(anyhow!("slot0 result too short"));
    }

    let sqrt_price_x96 = u256_from_be_slice(&slot0_bytes[0..32]);
    let price_x192 = sqrt_price_x96.saturating_mul(sqrt_price_x96);

    let token0_result = rpc_call(config.pool, SELECTOR_TOKEN0)?;
    let token0 = parse_address_from_32byte(&token0_result)
        .ok_or_else(|| anyhow!("Failed to parse token0 address"))?;

    let base = config.base.to_lowercase();
    let quote = config.quote.to_lowercase();

    let q192 = U256::one() << 192;

    let price_scaled = if token0.eq_ignore_ascii_case(&base) {
        // price = token1/token0
        // price_scaled = price * 10^6 * 10^dec0 / 10^dec1
        let numerator = price_x192
            .saturating_mul(pow10_u256(6))
            .saturating_mul(pow10_u256(config.base_decimals as u32));
        let denominator = q192.saturating_mul(pow10_u256(config.quote_decimals as u32));
        numerator / denominator
    } else if token0.eq_ignore_ascii_case(&quote) {
        // price = token0/token1 = 1 / (token1/token0)
        // price_scaled = 10^6 * 10^dec1 / 10^dec0 * 2^192 / price_x192
        if price_x192.is_zero() {
            return Err(anyhow!("Price is zero"));
        }
        let numerator = pow10_u256(6)
            .saturating_mul(pow10_u256(config.quote_decimals as u32))
            .saturating_mul(q192);
        let denominator = pow10_u256(config.base_decimals as u32)
            .saturating_mul(price_x192);
        numerator / denominator
    } else {
        return Err(anyhow!("token0 mismatch for pool"));
    };

    Ok(u256_to_u128(price_scaled)?)
}

fn rpc_call(to: &str, data: &str) -> Result<String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {
                "to": to,
                "data": format!("0x{data}"),
            },
            "latest"
        ]
    });

    let body_bytes = serde_json::to_vec(&body)?;
    let mut headers = std::collections::BTreeMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    let options = HttpFetchOptions {
        method: HttpFetchMethod::Post,
        headers,
        body: Some(body_bytes.to_bytes()),
        timeout_ms: Some(5_000),
    };

    let response = http_fetch(RPC_URL.to_string(), Some(options));
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        return Err(anyhow!("RPC call failed"));
    }

    let json_value: serde_json::Value = serde_json::from_slice(&response.bytes)?;
    let result = json_value
        .get("result")
        .and_then(|value| value.as_str())
        .ok_or_else(|| anyhow!("RPC response missing result"))?;

    Ok(result.to_string())
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
