use anyhow::Error;
use serde::Deserialize;

pub mod binance;
pub mod mexc;
pub mod okx;

fn _make_request<T: serde::de::DeserializeOwned>(api: &str, url: String) -> anyhow::Result<T> {
    let response = seda_sdk_rs::http_fetch(url, None);

    if !response.is_ok() {
        return Err(anyhow::anyhow!(
            "{api} API HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        ));
    }

    Ok(serde_json::from_slice(&response.bytes)?)
}

#[derive(Deserialize)]
struct StringPriceResponse {
    price: String,
}

#[inline]
fn make_request_price(api: &str, url: String) -> anyhow::Result<f32> {
    let data = _make_request::<StringPriceResponse>(api, url)?;
    let price: f32 = data.price.parse()?;
    Ok(price)
}

#[derive(Deserialize)]
struct LastPriceResponse {
    last: String,
}

#[derive(Deserialize)]
struct VecLastPriceResponse {
    data: Vec<LastPriceResponse>,
}

#[inline]
fn make_request_last_prices(api: &str, url: String) -> anyhow::Result<f32> {
    let data = _make_request::<VecLastPriceResponse>(api, url)?;
    match data.data.first() {
        Some(info) => {
            let price: f32 = info.last.parse()?;
            Ok(price)
        }
        None => Err(Error::msg("No data returned by Mexc")),
    }
}
