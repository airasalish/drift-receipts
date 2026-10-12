// Generated from Watchlist's own templates (backend/app/demo_user.py + routers/watchlist.py).
import type { WatchStock } from "./watchlistStore";

export interface ListTemplate {
  id: string;
  name: string;
  description: string;
  stocks: WatchStock[];
}

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    "id": "watchlist-starter",
    "name": "Watchlist starter list",
    "description": "The original Watchlist demo watchlist",
    "stocks": [
      {
        "yahoo": "NVDA",
        "gf": null,
        "name": "NVIDIA Corporation",
        "note": "Earnings"
      },
      {
        "yahoo": "TSLA",
        "gf": null,
        "name": "Tesla, Inc.",
        "note": "Just monitoring"
      },
      {
        "yahoo": "EA",
        "gf": null,
        "name": "Electronic Arts Inc.",
        "note": "Waiting for a price"
      },
      {
        "yahoo": "DKNG",
        "gf": null,
        "name": "DraftKings Inc.",
        "note": "Breakout"
      },
      {
        "yahoo": "RBLX",
        "gf": null,
        "name": "Roblox Corporation",
        "note": "Recovery"
      },
      {
        "yahoo": "ETERNAL.NS",
        "gf": "ETERNAL:NSE",
        "name": "Eternal Limited (Zomato)",
        "note": "Just monitoring"
      },
      {
        "yahoo": "NYKAA.NS",
        "gf": "NYKAA:NSE",
        "name": "FSN E-Commerce Ventures (Nykaa)",
        "note": "Long-term hold"
      },
      {
        "yahoo": "IRCTC.NS",
        "gf": "IRCTC:NSE",
        "name": "Indian Railway Catering and Tourism Corporation",
        "note": "Waiting for a price"
      },
      {
        "yahoo": "SWIGGY.NS",
        "gf": "SWIGGY:NSE",
        "name": "Swiggy Limited",
        "note": "Breakout"
      }
    ]
  },
  {
    "id": "technology",
    "name": "Technology",
    "description": "Major US tech companies",
    "stocks": [
      {
        "yahoo": "AAPL",
        "gf": null,
        "name": "Apple Inc.",
        "note": "Core holding"
      },
      {
        "yahoo": "MSFT",
        "gf": null,
        "name": "Microsoft Corporation",
        "note": "Core holding"
      },
      {
        "yahoo": "GOOGL",
        "gf": null,
        "name": "Alphabet Inc.",
        "note": "Core holding"
      },
      {
        "yahoo": "META",
        "gf": null,
        "name": "Meta Platforms Inc.",
        "note": "Growth"
      },
      {
        "yahoo": "AMZN",
        "gf": null,
        "name": "Amazon.com Inc.",
        "note": "Growth"
      }
    ]
  },
  {
    "id": "ai_semiconductors",
    "name": "AI & Semiconductors",
    "description": "AI infrastructure and chip makers",
    "stocks": [
      {
        "yahoo": "NVDA",
        "gf": null,
        "name": "NVIDIA Corporation",
        "note": "AI infrastructure"
      },
      {
        "yahoo": "AMD",
        "gf": null,
        "name": "Advanced Micro Devices",
        "note": "AI chips"
      },
      {
        "yahoo": "INTC",
        "gf": null,
        "name": "Intel Corporation",
        "note": "Semiconductors"
      },
      {
        "yahoo": "TSM",
        "gf": null,
        "name": "Taiwan Semiconductor",
        "note": "Manufacturing"
      },
      {
        "yahoo": "ASML",
        "gf": null,
        "name": "ASML Holding N.V.",
        "note": "Semiconductor equipment"
      }
    ]
  },
  {
    "id": "indian_large_caps",
    "name": "Indian Large Caps",
    "description": "Major Indian companies",
    "stocks": [
      {
        "yahoo": "RELIANCE.NS",
        "gf": "RELIANCE:NSE",
        "name": "Reliance Industries Limited",
        "note": "Conglomerate"
      },
      {
        "yahoo": "TCS.NS",
        "gf": "TCS:NSE",
        "name": "Tata Consultancy Services",
        "note": "IT services"
      },
      {
        "yahoo": "INFY.NS",
        "gf": "INFY:NSE",
        "name": "Infosys Limited",
        "note": "IT services"
      },
      {
        "yahoo": "HDFCBANK.NS",
        "gf": "HDFCBANK:NSE",
        "name": "HDFC Bank Limited",
        "note": "Banking"
      },
      {
        "yahoo": "ICICIBANK.NS",
        "gf": "ICICIBANK:NSE",
        "name": "ICICI Bank Limited",
        "note": "Banking"
      }
    ]
  },
  {
    "id": "us_mega_caps",
    "name": "US Mega Caps",
    "description": "Largest US companies by market cap",
    "stocks": [
      {
        "yahoo": "AAPL",
        "gf": null,
        "name": "Apple Inc.",
        "note": "Core holding"
      },
      {
        "yahoo": "MSFT",
        "gf": null,
        "name": "Microsoft Corporation",
        "note": "Core holding"
      },
      {
        "yahoo": "GOOGL",
        "gf": null,
        "name": "Alphabet Inc.",
        "note": "Core holding"
      },
      {
        "yahoo": "AMZN",
        "gf": null,
        "name": "Amazon.com Inc.",
        "note": "E-commerce"
      },
      {
        "yahoo": "NVDA",
        "gf": null,
        "name": "NVIDIA Corporation",
        "note": "AI chips"
      }
    ]
  },
  {
    "id": "banking",
    "name": "Banking",
    "description": "Major financial institutions",
    "stocks": [
      {
        "yahoo": "JPM",
        "gf": null,
        "name": "JPMorgan Chase & Co.",
        "note": "Investment banking"
      },
      {
        "yahoo": "BAC",
        "gf": null,
        "name": "Bank of America Corp",
        "note": "Banking"
      },
      {
        "yahoo": "WFC",
        "gf": null,
        "name": "Wells Fargo & Company",
        "note": "Banking"
      },
      {
        "yahoo": "C",
        "gf": null,
        "name": "Citigroup Inc.",
        "note": "Banking"
      },
      {
        "yahoo": "GS",
        "gf": null,
        "name": "Goldman Sachs Group",
        "note": "Investment banking"
      }
    ]
  },
  {
    "id": "ev_mobility",
    "name": "EV & Mobility",
    "description": "Electric vehicle and mobility companies",
    "stocks": [
      {
        "yahoo": "TSLA",
        "gf": null,
        "name": "Tesla, Inc.",
        "note": "EV leader"
      },
      {
        "yahoo": "BYDDY",
        "gf": null,
        "name": "BYD Company Limited",
        "note": "EV manufacturing"
      },
      {
        "yahoo": "NIO",
        "gf": null,
        "name": "NIO Inc.",
        "note": "EV manufacturing"
      },
      {
        "yahoo": "LCID",
        "gf": null,
        "name": "Lucid Group Inc.",
        "note": "EV manufacturing"
      },
      {
        "yahoo": "RIVN",
        "gf": null,
        "name": "Rivian Automotive Inc.",
        "note": "EV manufacturing"
      }
    ]
  },
  {
    "id": "nifty_50",
    "name": "Nifty 50",
    "description": "Major NSE-listed index constituents",
    "stocks": [
      {
        "yahoo": "RELIANCE.NS",
        "gf": "RELIANCE:NSE",
        "name": "Reliance Industries Limited",
        "note": "Energy conglomerate"
      },
      {
        "yahoo": "HDFCBANK.NS",
        "gf": "HDFCBANK:NSE",
        "name": "HDFC Bank Limited",
        "note": "Private banking"
      },
      {
        "yahoo": "ICICIBANK.NS",
        "gf": "ICICIBANK:NSE",
        "name": "ICICI Bank Limited",
        "note": "Private banking"
      },
      {
        "yahoo": "INFY.NS",
        "gf": "INFY:NSE",
        "name": "Infosys Limited",
        "note": "IT services"
      },
      {
        "yahoo": "ITC.NS",
        "gf": "ITC:NSE",
        "name": "ITC Limited",
        "note": "FMCG conglomerate"
      }
    ]
  },
  {
    "id": "pharma",
    "name": "Pharma",
    "description": "Major pharmaceutical companies",
    "stocks": [
      {
        "yahoo": "PFE",
        "gf": null,
        "name": "Pfizer Inc.",
        "note": "Pharmaceuticals"
      },
      {
        "yahoo": "JNJ",
        "gf": null,
        "name": "Johnson & Johnson",
        "note": "Healthcare"
      },
      {
        "yahoo": "SUNPHARMA.NS",
        "gf": "SUNPHARMA:NSE",
        "name": "Sun Pharmaceutical Industries",
        "note": "Indian pharma"
      },
      {
        "yahoo": "DRREDDY.NS",
        "gf": "DRREDDY:NSE",
        "name": "Dr. Reddy's Laboratories",
        "note": "Indian pharma"
      },
      {
        "yahoo": "CIPLA.NS",
        "gf": "CIPLA:NSE",
        "name": "Cipla Limited",
        "note": "Indian pharma"
      }
    ]
  },
  {
    "id": "dividends",
    "name": "Dividends",
    "description": "Stocks with consistent dividend payouts",
    "stocks": [
      {
        "yahoo": "JNJ",
        "gf": null,
        "name": "Johnson & Johnson",
        "note": "Dividend aristocrat"
      },
      {
        "yahoo": "KO",
        "gf": null,
        "name": "The Coca-Cola Company",
        "note": "Dividend king"
      },
      {
        "yahoo": "PG",
        "gf": null,
        "name": "Procter & Gamble Co.",
        "note": "Consumer staples"
      },
      {
        "yahoo": "VZ",
        "gf": null,
        "name": "Verizon Communications",
        "note": "Telecom dividends"
      },
      {
        "yahoo": "ITC.NS",
        "gf": "ITC:NSE",
        "name": "ITC Limited",
        "note": "High dividend yield"
      }
    ]
  }
];
