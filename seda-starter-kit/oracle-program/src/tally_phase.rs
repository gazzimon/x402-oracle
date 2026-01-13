use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{HttpFetchResponse, Process, elog, get_unfiltered_reveals, log};
use serde::Deserialize;
use std::collections::HashMap;

const TARGET_BASE_SYMBOL: &str = "WCRO";
const TARGET_QUOTE_SYMBOL: &str = "USDC";
const PRICE_DECIMALS: u32 = 8;
const LIQUIDITY_DECIMALS: u32 = 18;

#[derive(Deserialize)]
struct VvsPairsResponse {
    data: HashMap<String, VvsPair>,
}

#[derive(Deserialize)]
struct VvsPair {
    base_symbol: String,
    quote_symbol: String,
    price: String,
    liquidity: String,
}

pub fn tally_phase() -> Result<()> {
    let reveals = get_unfiltered_reveals()?;

    if reveals.len() != 1 {
        elog!(
            "Expected exactly one reveal (replication factor 1), found {}",
            reveals.len()
        );
        return Err(anyhow::anyhow!("Invalid number of reveals"));
    }

    let http_response: HttpFetchResponse = serde_json::from_slice(&reveals[0].body.reveal)?;

    if !http_response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            http_response.status,
            String::from_utf8(http_response.bytes.clone())?
        );
        return Err(anyhow::anyhow!("HTTP response not OK"));
    }

    let response_data = serde_json::from_slice::<VvsPairsResponse>(&http_response.bytes)?;

    let mut selected_price: Option<String> = None;
    let mut selected_liquidity: Option<u128> = None;

    for pair in response_data.data.values() {
        if pair.base_symbol != TARGET_BASE_SYMBOL || pair.quote_symbol != TARGET_QUOTE_SYMBOL {
            continue;
        }

        let liquidity = match parse_decimal_to_u128(&pair.liquidity, LIQUIDITY_DECIMALS) {
            Some(value) => value,
            None => continue,
        };

        let should_select = match selected_liquidity {
            Some(current) => liquidity > current,
            None => true,
        };

        if should_select {
            selected_liquidity = Some(liquidity);
            selected_price = Some(pair.price.clone());
        }
    }

    let price_str = selected_price.ok_or_else(|| {
        anyhow::anyhow!("No WCRO/USDC pool found in VVS response")
    })?;

    let price_scaled = parse_decimal_to_u128(&price_str, PRICE_DECIMALS)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse WCRO/USD price"))?;

    log!("Selected WCRO/USD price: {price_str} (scaled: {price_scaled})");

    let result = ethabi::encode(&[Token::Uint(U256::from(price_scaled))]);
    Process::success(&result);

    Ok(())
}

fn parse_decimal_to_u128(value: &str, scale: u32) -> Option<u128> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut parts = trimmed.split('.');
    let whole = parts.next().unwrap_or("0");
    let fraction = parts.next().unwrap_or("");

    if parts.next().is_some() {
        return None;
    }

    if !whole.chars().all(|c| c.is_ascii_digit()) || !fraction.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    let mut combined = String::new();
    combined.push_str(whole);

    if scale > 0 {
        let mut frac = fraction.to_string();
        let target_len = scale as usize;
        if frac.len() < target_len {
            frac.push_str(&"0".repeat(target_len - frac.len()));
        } else if frac.len() > target_len {
            frac.truncate(target_len);
        }
        combined.push_str(&frac);
    }

    let trimmed_combined = combined.trim_start_matches('0');
    if trimmed_combined.is_empty() {
        return Some(0);
    }

    trimmed_combined.parse::<u128>().ok()
}
