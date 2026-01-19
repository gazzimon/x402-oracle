use anyhow::Result;

const API_URL: &str = "https://www.okx.com/api/v5/market/ticker?instId=";

pub fn fetch_token_price(symbol_a: &str, symbol_b: &str) -> Result<f32> {
    let url = format!("{API_URL}{symbol_a}-{symbol_b}");
    crate::feeds::make_request_last_prices("Okx", url)
}
