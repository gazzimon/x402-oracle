use anyhow::{Result, anyhow};
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{HttpFetchOptions, Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "https://seda-proxy.blocksize.dev/proxy/bidask/";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "029a10be2771c4933b1a0f4d5efa9d6cdfbd05b0b1749587fc1b1771394490d29b";

#[cfg(feature = "mainnet")]
const API_URL: &str = "https://seda-proxy.blocksize.capital/proxy/bidask/";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "03748c38f98a18b0ca8da9a33ede357f6502b2f5ea3c42c540cca54458a1ed340e";

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

// {
//   "ticker": "ETHUSD",
//   "agg_bid_price": "4362.597230371793",
//   "agg_bid_size": "98.42767488000001",
//   "agg_ask_price": "4364.092969924804",
//   "agg_ask_size": "125.29260208",
//   "agg_mid_price": "4363.345100148298",
//   "ts": 1756156227634385
// }

const VALID_FIELDS: &[&str] = &[
    "agg_bid_price",
    "agg_bid_size",
    "agg_ask_price",
    "agg_ask_size",
    "agg_mid_price",
    "ts",
];

// do all fields by default
// return a uint256[] abi encoded in tally
#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbol" (e.g., "ETHUSD" or "BTCUSD").
    // Optionally followed by the field names (e.g., "agg_ask_price,agg_mid_price") separated by a hyphen(-).
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    if dr_inputs_raw.is_empty() {
        // If no input is provided, log an error and return.
        elog!("No input provided for the equity price request.");
        Process::error("No input provided".as_bytes());
        return Ok(());
    }

    let parts: Vec<&str> = dr_inputs_raw.split('-').collect();
    let (pair, fields) = match parts.as_slice() {
        // validate that each field is in the valid fields list
        [pair, fields] => (
            pair,
            fields
                .split(',')
                .filter(|field| {
                    let in_map = VALID_FIELDS.contains(field);
                    if !in_map {
                        elog!("Invalid field: {field}");
                    }
                    in_map
                })
                .collect::<Vec<_>>(),
        ),
        [pair] => (pair, VALID_FIELDS.to_vec()),
        _ => {
            elog!("Invalid input format");
            Process::error("Invalid input format".as_bytes());
            return Ok(());
        }
    };

    if fields.is_empty() {
        Process::error("No valid fields requested".as_bytes());
    }

    log!("Fetching price for: {pair}, and using {fields:?}");

    let url = [API_URL, pair].concat();
    let response = proxy_http_fetch(
        url,
        Some(PROXY_PUBLIC_KEY.to_string()),
        Some(HttpFetchOptions {
            method: seda_sdk_rs::HttpFetchMethod::Get,
            headers: Default::default(),
            body: None,
            timeout_ms: Some(20000),
        }),
    );

    // Handle the case where the HTTP request failed or was rejected.
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {} ProxyPublicKey {PROXY_PUBLIC_KEY}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching equity price".as_bytes());
        return Ok(());
    }

    // Parse the API response as defined earlier.
    let response_data = serde_json::from_slice::<serde_json::Map<String, serde_json::value::Value>>(
        &response.bytes,
    )?;

    let parsed_field_values: Vec<u8> = fields
        .into_iter()
        .flat_map(|field| {
            let value = if field != "ts" {
                let price = response_data
                    .get(field)
                    .and_then(|price| price.as_str())
                    .ok_or_else(|| anyhow!("{field} not found in response or is invalid"))?;
                let price_lossless = make_price(price, 6)?;
                log!("Fetched {field}: {price_lossless:?}");
                price_lossless.to_le_bytes()
            } else {
                let timestamp = response_data
                    .get(field)
                    .and_then(|ts| ts.as_u64())
                    .ok_or_else(|| anyhow!("{field} not found in response or is invalid"))?;
                log!("Fetched {field}: {timestamp:?}");
                (timestamp as u128).to_le_bytes()
            };
            Ok::<_, anyhow::Error>(value)
        })
        .flatten()
        .collect();

    // Report the successful result back to the SEDA network.
    Process::success(&parsed_field_values);

    Ok(())
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
