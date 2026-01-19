use anyhow::Result;
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "http://98.84.79.123:5384/proxy/uslf_q/";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "0375038bc3e61dc2a52e24ff207a5753e38d020a06fff9efc8ec96875f72f4d081";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://seda-proxy.dxfeed.com:5384/proxy/uslf_q/";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "021dd035f760061e2833581d4ab50440a355db0ac98e489bf63a5dbc0e89e4af79";

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    use crate::VerificationData;

    #[cfg(not(feature = "test"))]
    if Process::replication_factor() != 1 {
        elog!(
            "Replication factor must be 1 for the single price feed verification oracle program."
        );
        Process::error("Invalid replication factor".as_bytes());
        return Ok(());
    }

    // Expected to be in the format "symbol,..." (e.g., "AAPL" or "GOOG").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    if dr_inputs_raw.is_empty() {
        // If no input is provided, log an error and return.
        elog!("No input provided for the equity price request.");
        Process::error("No input provided".as_bytes());
        return Ok(());
    }

    // Log the asset being fetched as part of the Execution Standard Out.
    log!("Fetching price for: {dr_inputs_raw}");

    let url = [API_URL, &dr_inputs_raw].concat();
    let response = proxy_http_fetch(url, Some(PROXY_PUBLIC_KEY.to_string()), None);

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

    let data = VerificationData {
        response,
        symbol: dr_inputs_raw,
    };
    let data_json = serde_json::to_vec(&data)?;
    Process::success(&data_json);

    Ok(())
}
