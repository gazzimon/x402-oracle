use anyhow::Result;
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;
    let mut revealed_prices: Vec<f64> = Vec::with_capacity(reveals.len());

    for reveal in reveals {
        let reveal_bytes = &reveal.body.reveal;
        let price = match reveal_bytes.as_slice().try_into() {
            Ok(bytes) => f64::from_le_bytes(bytes),
            Err(_) => {
                elog!(
                    "Failed to parse revealed price: expected 8 bytes for f64, got {} bytes",
                    reveal_bytes.len()
                );
                continue;
            }
        };

        revealed_prices.push(price);
    }

    if revealed_prices.is_empty() {
        // If no valid prices were revealed, report an error indicating no consensus.
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // If there are valid prices revealed, calculate the median price from price reports.
    let final_price = median(&revealed_prices);
    log!("Final median prices: {final_price:?}");

    // Report the successful result in the tally phase.
    Process::success(final_price.to_string().as_bytes());

    Ok(())
}

/// Finds the median of a list of prices per price report using f64 values.
fn median(data: &[f64]) -> f64 {
    let mut vals = data.to_vec();
    vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = vals.len() / 2;

    if vals.len() % 2 == 0 {
        (vals[mid - 1] + vals[mid]) / 2.0
    } else {
        vals[mid]
    }
}
