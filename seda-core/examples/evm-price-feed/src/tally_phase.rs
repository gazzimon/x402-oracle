use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

/// Executes the tally phase within the SEDA network.
/// This phase aggregates the results (e.g., price data) revealed during the execution phase,
/// calculates the median value, and submits it as the final result.
/// Note: The number of reveals depends on the replication factor set in the data request parameters.
pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;
    let mut revealed_prices: Vec<Vec<u128>> = Vec::with_capacity(reveals.len());

    // Iterate over each reveal, parse its content as an unsigned integer (u128), and store it in the prices array.
    for reveal in reveals {
        let prices = match serde_json::from_slice::<Vec<u128>>(&reveal.body.reveal) {
            Ok(prices) => prices,
            Err(err) => {
                elog!("Failed to parse revealed prices: {err}");
                continue;
            }
        };

        revealed_prices.push(prices);
    }

    if revealed_prices.is_empty() {
        // If no valid prices were revealed, report an error indicating no consensus.
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // If there are valid prices revealed, calculate the median price from price reports.
    let final_prices = median_each_asset(&revealed_prices)?;
    log!("Final median prices: {final_prices:?}",);

    // Encode final prices as ABI-encoded bytes for EVM contract use
    let encoded_result = ethabi::encode(&[Token::Array(final_prices)]);
    Process::success(&encoded_result);

    Ok(())
}

/// Calculates the median of a sorted vector
fn median_sorted(vals: &[u128]) -> u128 {
    let mid = vals.len() / 2;
    if vals.len() % 2 == 0 {
        vals[mid - 1].midpoint(vals[mid])
    } else {
        vals[mid]
    }
}

/// Finds the median of a list of prices per price report.
/// Returns an error if the data is inconsistent or empty.
fn median_each_asset(data: &[Vec<u128>]) -> Result<Vec<Token>> {
    if data.is_empty() {
        return Err(anyhow::anyhow!("No data provided for median calculation"));
    }

    let m = data[0].len();
    if m == 0 {
        return Err(anyhow::anyhow!("Empty price vectors provided"));
    }

    // Verify all rows have the same length
    if !data.iter().all(|row| row.len() == m) {
        elog!("Inconsistent row lengths in data reveals");
        Process::error("Inconsistent row lengths in data reveals".as_bytes());
        return Err(anyhow::anyhow!("Inconsistent data structure"));
    }

    // Calculate median for each column
    Ok((0..m)
        .map(|col| {
            let mut vals: Vec<u128> = data.iter().map(|row| row[col]).collect();
            vals.sort();
            median_sorted(&vals)
        })
        .map(|p| Token::Int(U256::from(p)))
        .collect())
}
