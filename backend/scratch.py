import yfinance as yf
import json

def test_news():
    spy = yf.Ticker("SPY")
    news = spy.news
    print(json.dumps(news, indent=2))

if __name__ == "__main__":
    test_news()
