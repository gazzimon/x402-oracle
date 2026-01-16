use anyhow::{Result, anyhow};
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "http://98.84.79.123:5384/proxy/cfd/";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "0375038bc3e61dc2a52e24ff207a5753e38d020a06fff9efc8ec96875f72f4d081";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://seda-proxy.dxfeed.com:5384/proxy/cfd/";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "021dd035f760061e2833581d4ab50440a355db0ac98e489bf63a5dbc0e89e4af79";

#[cfg(feature = "testnet")]
const ALLOWED_COMMODITIES: [&str; 3] = ["WTI", "BRN", "XAU"];
#[cfg(feature = "mainnet")]
const ALLOWED_COMMODITIES: [&str; 11] = [
    "DJI", "XPT", "WTI", "BRN", "SPX", "CAU", "XPD", "CUC", "NDX", "NGC", "XAG",
];

fn parse_input_pair(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("No input provided"));
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

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

// {
//   "Quote": {
//     "XAU/USD:BFX": {
//       "askExchangeCode": "",
//       "askPrice": 3313.99,
//       "askSize": 100,
//       "askTime": 1753710744000,
//       "bidExchangeCode": "",
//       "bidPrice": 3313.83,
//       "bidSize": 100,
//       "bidTime": 1753710744000,
//       "eventSymbol": "XAU/USD:BFX",
//       "eventTime": 0,
//       "sequence": 0,
//       "timeNanoPart": 0
//     }
//   },
//   "status": "OK"
// }

/// The response structure for commodity price requests.
#[derive(serde::Deserialize)]
struct CommodityPriceResponse {
    #[serde(rename = "Quote")]
    quote: serde_json::value::Map<String, serde_json::value::Value>,
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbol,..." (e.g., "XAU" or "BRN").

    use seda_sdk_rs::HttpFetchOptions;
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    let symbol = parse_input_pair(&dr_inputs_raw)?.to_uppercase();

    if !ALLOWED_COMMODITIES.contains(&symbol.as_str()) {
        elog!("Unsupported commodity symbol: {symbol}");
        Process::error("Unsupported commodity".as_bytes());
        return Ok(());
    }

    // Log the asset being fetched as part of the Execution Standard Out.
    log!("Fetching price for: {symbol}");

    // Get the price in USD
    let url = [API_URL, &symbol, "/USD"].concat();
    let response = proxy_http_fetch(
        url,
        Some(PROXY_PUBLIC_KEY.to_string()),
        Some(HttpFetchOptions {
            method: seda_sdk_rs::HttpFetchMethod::Get,
            headers: Default::default(),
            body: None,
            timeout_ms: Some(20_000),
        }),
    );

    // Handle the case where the HTTP request failed or was rejected.
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching commodity price".as_bytes());
        return Ok(());
    }

    // Parse the API response as defined earlier.
    let response_data = match serde_json::from_slice::<CommodityPriceResponse>(&response.bytes) {
        Ok(data) => data,
        Err(err) => {
            let data = String::from_utf8(response.bytes)?;
            elog!("Failed to parse API response: {err}, response data: {data}");
            Process::error("Failed to parse API response".as_bytes());
            return Ok(());
        }
    };

    let price = response_data
        .quote
        .get(&format!("{symbol}/USD:BFX"))
        .and_then(|quote| quote.get("askPrice"))
        .and_then(|price| price.as_f64())
        .ok_or_else(|| anyhow::anyhow!("Price not found in response"))?;
    let price_lossless = (price * 1_000_000.0) as u128;
    log!("Fetched price: {price_lossless:?}");

    // Scaled 1e6 u128, serialized little-endian for tally.
    Process::success(&price_lossless.to_le_bytes());

    Ok(())
}
