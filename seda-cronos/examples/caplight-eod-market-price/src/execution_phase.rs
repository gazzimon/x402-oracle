use anyhow::{Result, anyhow};
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "http://104.155.34.32:5384/proxy/market-price-fixed-eod?";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "0306346975352e34719df41928048482b285d24cd27f8e5fc2df7e4095f9cc14cf";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://34.14.120.47:5384/proxy/market-price-fixed-eod?";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "02088452cd5025f33d7ce95ee8eb7ba34b94b518ea23b1897665e1afdbcae2ca18";

const ALLOWED_PITCHBOOK_IDS: [&str; 1] = ["54782-29"];

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

// Response example:
// {
// 	"date": "2022-09-10",
// 	"price": 15.9,
// 	"estimatedValuation": 2150000000,
// 	"priceStandardError": 1.35,
// 	"generatedAtTimestamp": 1690000000,
// 	"daysSinceLastDataPoint": 10,
// 	"numberOfPoints6mo": 12,
// 	"orderImbalance": {
// 		"bidContribution": 0.53,
// 		"offerContribution": 0.25
// 	}
// }

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    use seda_sdk_rs::{HttpFetchMethod, HttpFetchOptions};

    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    let pitchbook_id = parse_input_pair(&dr_inputs_raw)?;
    if !ALLOWED_PITCHBOOK_IDS.contains(&pitchbook_id.as_str()) {
        elog!("Unsupported pitchbook id: {pitchbook_id}");
        Process::error("Unsupported pitchbook id".as_bytes());
        return Ok(());
    }

    // Log the asset being fetched as part of the Execution Standard Out.
    log!("Fetching price for: {pitchbook_id}");

    let url = [API_URL, "pitchbookId=", &pitchbook_id].concat();
    let response = proxy_http_fetch(
        url,
        Some(PROXY_PUBLIC_KEY.to_string()),
        Some(HttpFetchOptions {
            method: HttpFetchMethod::Get,
            headers: Default::default(),
            body: None,
            timeout_ms: Some(20_000),
        }),
    );

    // Check if the HTTP request was successfully fulfilled or not.
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching equity price".as_bytes());
        return Ok(());
    }

    // Parse the API response as defined earlier.
    let response_data = serde_json::from_slice::<serde_json::Value>(&response.bytes)?;

    let price = response_data
        .get("price")
        .and_then(|price| price.as_f64())
        .ok_or_else(|| anyhow::anyhow!("Price not found in response"))?;

    let price_lossless = (price * 1_000_000.0) as u128;
    log!("Fetched price: {price_lossless:?}");

    // Scaled 1e6 u128, serialized little-endian for tally.
    Process::success(&price_lossless.to_le_bytes());

    Ok(())
}
