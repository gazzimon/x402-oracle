use anyhow::{Result, anyhow};
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    if let Err(err) = tally_phase_inner() {
        elog!("Tally error: {err}");
        Process::error(format!("Tally error: {err}").as_bytes());
    }

    Ok(())
}

fn tally_phase_inner() -> Result<()> {
    let reveals = get_reveals()?;
    let mut revealed_values: Vec<Vec<U256>> = Vec::new();

    for reveal in reveals {
        let decoded = decode_values(&reveal.body.reveal);
        match decoded {
            Ok(values) => {
                log!("Received values: {:?}", values);
                revealed_values.push(values);
            }
            Err(err) => {
                elog!("Reveal decode failed: {err}");
            }
        }
    }

    if revealed_values.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
    }

    let final_values = median_each_field(&revealed_values)?;
    let result = ethabi::encode(&[Token::Array(
        final_values
            .into_iter()
            .map(Token::Int)
            .collect(),
    )]);
    Process::success(&result);
}

fn decode_values(bytes: &[u8]) -> Result<Vec<U256>> {
    let tokens = ethabi::decode(
        &[ethabi::ParamType::Array(Box::new(ethabi::ParamType::Int(256)))],
        bytes,
    )?;
    let array = match tokens.first() {
        Some(Token::Array(values)) => values,
        _ => return Err(anyhow!("Expected array token")),
    };
    if array.len() != 4 {
        return Err(anyhow!("Expected 4 values, got {}", array.len()));
    }
    let mut values = Vec::with_capacity(array.len());
    for token in array {
        match token {
            Token::Int(value) => values.push(*value),
            _ => return Err(anyhow!("Expected int256 token")),
        }
    }
    Ok(values)
}

fn median_each_field(values: &[Vec<U256>]) -> Result<Vec<U256>> {
    if values.is_empty() {
        return Err(anyhow!("No values to aggregate"));
    }
    if !values.iter().all(|row| row.len() == 4) {
        return Err(anyhow!("Mismatched value length in reveals"));
    }

    let mut medians = Vec::with_capacity(4);
    for idx in 0..4 {
        let mut col: Vec<U256> = values.iter().map(|row| row[idx]).collect();
        col.sort();
        medians.push(median_sorted(&col));
    }
    Ok(medians)
}

fn median_sorted(values: &[U256]) -> U256 {
    let mid = values.len() / 2;
    if values.len() % 2 == 0 {
        (values[mid - 1] + values[mid]) / U256::from(2u8)
    } else {
        values[mid]
    }
}
