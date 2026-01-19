use anyhow::{Result, anyhow};
use serde::Deserialize;

const API_URL: &str = "https://api.binance.com/api/v3/ticker/price?symbol=";

#[derive(Deserialize)]
struct StringPriceResponse {
    price: String,
}

/// Fetch the current price for a trading pair from the Binance API.
///
/// - symbol_a: base asset (e.g., "BTC")
/// - symbol_b: quote asset (e.g., "USDT")
/// - decimals: desired decimal precision for the returned integer
///
/// Returns the price as u128 with the specified decimal precision.
pub fn fetch_token_price(symbol_a: &str, symbol_b: &str, decimals: u32) -> Result<u128> {
    if symbol_a.is_empty() || symbol_b.is_empty() {
        return Err(anyhow!("Invalid symbols: '{symbol_a}' and '{symbol_b}'"));
    }

    let url = format!("{API_URL}{symbol_a}{symbol_b}");
    let response = seda_sdk_rs::http_fetch(url, None);

    if !response.is_ok() {
        return Err(anyhow!(
            "Binance API HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        ));
    }

    let data: StringPriceResponse = serde_json::from_slice(&response.bytes)?;
    make_price(&data.price, decimals)
}

/// Convert a decimal price string (e.g., "1234.5678") into a u128 with `decimals` precision.
/// - Truncates extra precision if the input has more decimals than requested.
/// - Multiplies (with overflow checks) if the input has fewer decimals than requested.
fn make_price(price_str: &str, decimals: u32) -> Result<u128> {
    let (int_part, frac_part) = match price_str.split_once('.') {
        Some((i, f)) => (i, f),
        None => (price_str, ""),
    };

    let digits = format!("{int_part}{frac_part}");
    if digits.is_empty() {
        return Err(anyhow!("Empty price string"));
    }

    let price_int = digits
        .parse::<u128>()
        .map_err(|_| anyhow!("Failed to parse price: {price_str}"))?;

    let decimal_places = frac_part.len() as u32;

    let result = if decimal_places >= decimals {
        price_int / 10_u128.pow(decimal_places - decimals)
    } else {
        let mul = 10_u128
            .checked_pow(decimals - decimal_places)
            .ok_or_else(|| anyhow!("Price conversion overflow"))?;
        price_int
            .checked_mul(mul)
            .ok_or_else(|| anyhow!("Price conversion overflow"))?
    };

    Ok(result)
}
