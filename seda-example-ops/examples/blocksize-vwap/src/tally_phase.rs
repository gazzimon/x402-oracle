use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;
    let mut revealed_fields: Vec<Vec<u128>> = Vec::with_capacity(reveals.len());

    // Iterate over each reveal, parse its content as an unsigned integer (u128), and store it in the prices array.
    for reveal in reveals {
        revealed_fields.push(
            reveal
                .body
                .reveal
                .as_slice()
                .chunks_exact(size_of::<u128>())
                .map(|chunk| {
                    let arr: [u8; 16] = chunk
                        .try_into()
                        .map_err(|_| anyhow::anyhow!("invalid u128 bytes"))?;
                    Ok::<_, anyhow::Error>(u128::from_le_bytes(arr))
                })
                .collect::<Result<Vec<_>, _>>()?,
        );
    }

    // If no valid prices were revealed, report an error indicating no consensus.
    if revealed_fields.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // If there are valid prices revealed, calculate the median price from price reports.
    let final_prices = median_each_field(&revealed_fields);

    log!("Final median prices: {final_prices:?}");
    // Encode the final median price as a EVM `uint256`.
    let result = ethabi::encode(&[final_prices]);
    // Report the successful result in the tally phase.
    Process::success(&result);

    Ok(())
}

/// Finds the median of a list preserving the order of the fields
fn median_each_field(data: &[Vec<u128>]) -> Token {
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
