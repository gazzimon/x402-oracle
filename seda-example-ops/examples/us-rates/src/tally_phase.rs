use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

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
    let final_prices = median_each_asset(&revealed_prices);
    log!("Final median prices: {final_prices:?}");

    let result = ethabi::encode(&[final_prices]);

    // Report the successful result in the tally phase, encoding the result as bytes.
    // Encoding result with big endian to decode from EVM contracts.
    Process::success(&result);

    Ok(())
}

/// Finds the median of a list of prices per price report.
fn median_each_asset(data: &[Vec<u128>]) -> Token {
    let m = data[0].len();

    if !data.iter().all(|row| row.len() == m) {
        Process::error("Inconsistent row lengths in data reveals".as_bytes());
    }

    let mut result = Vec::with_capacity(m);
    (0..m).for_each(|col| {
        // collect the col-th value from each reveal
        let mut vals = Vec::with_capacity(data.len());
        data.iter().for_each(|row| vals.push(row[col]));
        vals.sort();
        let mid = vals.len() / 2;

        let median_price = if vals.len() % 2 == 0 {
            // safe average of two u128s without overflow
            let a = vals[mid - 1];
            let b = vals[mid];
            a.midpoint(b)
        } else {
            vals[mid]
        };

        // convert to Token::Uint for encoding
        result.push(Token::Uint(U256::from(median_price)));
    });
    Token::Array(result)
}
