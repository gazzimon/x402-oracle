use anyhow::Result;
#[cfg(feature = "eth-result")]
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;
    let mut revealed_prices = Vec::with_capacity(reveals.len());

    // Iterate over each reveal, parse its content as an unsigned integer (u128), and store it in the prices array.
    for reveal in reveals {
        let price = match reveal.body.reveal.as_slice().try_into() {
            Ok(price) => u128::from_le_bytes(price),
            Err(err) => {
                elog!("Failed to parse revealed prices: {err}");
                continue;
            }
        };

        revealed_prices.push(price);
    }

    // If no valid prices were revealed, report an error indicating no consensus.
    if revealed_prices.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // If there are valid prices revealed, calculate the median price from price reports.
    let final_price: u128 = median(&revealed_prices);
    log!("Final median prices: {final_price:?}");

    #[cfg(feature = "eth-result")]
    {
        // Encode the final median price as a EVM `uint256`.
        let result = ethabi::encode(&[Token::Uint(U256::from(final_price))]);
        // Report the successful result in the tally phase.
        Process::success(&result);
    }

    #[cfg(feature = "str-result")]
    {
        let final_price: f64 = final_price as f64 / 10_000.0;
        // Convert the final median price back to f64 for string representation.
        // Report the successful result in the tally phase.
        Process::success(final_price.to_string().as_bytes());
    }

    Ok(())
}

/// Finds the median of a list of prices per price report.
fn median(data: &[u128]) -> u128 {
    let m = data.len();

    // If there are no valid prices, report an error.
    if m == 0 {
        Process::error("No valid data available for median calculation".as_bytes());
    }

    let mut sorted_data = data.to_vec();
    sorted_data.sort_unstable();

    if m % 2 == 0 {
        // safe average of two u128s without overflow
        let a = sorted_data[m / 2 - 1];
        let b = sorted_data[m / 2];
        // this does floor((a + b) / 2) safely via bit operations
        a.midpoint(b)
    } else {
        sorted_data[m / 2]
    }

    // convert to Token::Uint for encoding
    //
}
