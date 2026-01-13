use anyhow::Result;
use seda_sdk_rs::{Process, elog, http_fetch, log};

const API_URL: &str = "https://api.vvs.finance/info/api/pairs";

pub fn execution_phase() -> Result<()> {
    #[cfg(not(feature = "test"))]
    if Process::replication_factor() != 1 {
        elog!("Replication factor must be 1 for this oracle program.");
        Process::error("Invalid replication factor".as_bytes());
        return Ok(());
    }

    log!("Fetching VVS pairs from {API_URL}");

    let response = http_fetch(API_URL.to_string(), None);

    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching VVS pairs".as_bytes());
        return Ok(());
    }

    // Pass the HTTP response through to the tally phase for parsing.
    Process::success(&serde_json::to_vec(&response)?);

    Ok(())
}
