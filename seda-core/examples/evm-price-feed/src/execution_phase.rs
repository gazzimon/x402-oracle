use anyhow::Result;
use seda_sdk_rs::{Process, elog, log};

pub fn execution_phase() -> Result<()> {
    // Retrieve the input parameters for the data request (DR).
    // Expected to be in the format "symbolA-symbolB,SymbolC-symboldD,..." (e.g., "BTC-USD,ETH-USD").
    let dr_inputs = ethabi::decode(
        &[ethabi::ParamType::Array(Box::new(
            ethabi::ParamType::String,
        ))],
        &Process::get_inputs(),
    );

    // Check if the input is valid and not empty.
    let dr_inputs = match dr_inputs {
        Ok(v) if !v.is_empty() => v,
        _ => {
            elog!("Invalid or missing input for price feed request.");
            Process::error("Invalid input: missing or failed to decode".as_bytes());
            return Ok(());
        }
    };

    // Extract the inner array from the decoded result
    let dr_inputs = match &dr_inputs[0] {
        ethabi::Token::Array(tokens) => tokens,
        _ => {
            elog!("Expected array of strings");
            Process::error("Invalid input format".as_bytes());
            return Ok(());
        }
    };

    // One-pass: validate pair and fetch immediately; exit on first error
    let mut prices = Vec::new();
    for token in dr_inputs {
        let pair = match token {
            ethabi::Token::String(s) => s,
            _ => {
                elog!("Expected string token, got: {:?}", token);
                Process::error("Invalid token type".as_bytes());
                return Ok(());
            }
        };

        let parts: Vec<_> = pair.split('-').collect();
        if parts.len() != 2 {
            elog!("Invalid symbol pair format: {pair}. Expected format: symbolA-symbolB");
            Process::error(format!("Invalid symbol pair format: {pair}").as_bytes());
            return Ok(());
        }

        match crate::feeds::binance::fetch_token_price(parts[0], parts[1], 6) {
            Ok(price) => prices.push(price),
            Err(error) => {
                elog!(
                    "Failed to fetch price for {}-{}: {}",
                    parts[0],
                    parts[1],
                    error
                );
                Process::error("Failed to fetch prices".as_bytes());
                return Ok(());
            }
        }
    }

    // Report the successful result back to the SEDA network
    log!("Successfully fetched {} prices: {:?}", prices.len(), prices);
    let result = serde_json::to_vec(&prices)?;
    Process::success(&result);

    Ok(())
}
