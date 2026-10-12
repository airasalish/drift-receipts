import { Link } from "react-router-dom";
import { useTitle } from "./data";

const REPO = "https://github.com/airasalish/receipts";

export function About() {
  useTitle("About");
  return (
    <article className="ab">
      <header className="ab-head">
        <span className="rx-eyebrow">About</span>
        <h1>Receipts keeps score on YouTube stock tips</h1>
        <p>
          Lots of people get stock tips from YouTube. Nobody checks if those tips worked. Receipts does: it finds the exact second a creator recommended a stock, then
          looks at what that stock did over the next month.
        </p>
      </header>

      <section className="ab-grid">
        <div className="ab-card">
          <h2>Who it's for</h2>
          <p>Anyone who has watched a “top 5 stocks to buy” video and wondered whether to trust it. You don't need to know anything about stocks to use it.</p>
        </div>
        <div className="ab-card">
          <h2>What “better than the market” means</h2>
          <p>
            The market is the Nifty 50: India's 50 biggest companies together. If a tip did worse than that, you'd have been better off not picking at all. A stock can
            lose money and still beat a market that lost more, so we always show both.
          </p>
        </div>
        <div className="ab-card">
          <h2>How a tip gets checked</h2>
          <ol>
            <li>We find a creator's recent stock videos and their transcripts.</li>
            <li>AI reads the transcript and lists each stock recommended, with the exact quote.</li>
            <li>If that quote isn't in the transcript, word for word, the tip is thrown out.</li>
            <li>A month later, the stock's move is compared with the market's. That part is plain maths, no AI.</li>
          </ol>
        </div>
        <div className="ab-card">
          <h2>Where the data comes from</h2>
          <ul>
            <li>
              <b>YouTube</b> videos, upload dates and transcripts, via SerpApi
            </li>
            <li>
              <b>Google Finance</b> prices, via SerpApi. It covers small stocks other free sources miss.
            </li>
            <li>
              <b>Google News and Google Search</b> for headlines and SEBI pages, via SerpApi
            </li>
            <li>
              <b>Yahoo Finance</b> for the live Nifty 50 level and watchlist charts
            </li>
          </ul>
        </div>
      </section>

      <section className="ab-card ab-warn">
        <h2>What Receipts is not</h2>
        <ul>
          <li>
            <b>Not investment advice.</b> It tells you what happened, not what to buy.
          </li>
          <li>
            <b>Not an accusation.</b> A bad record isn't a crime. The pump-and-dump check flags a price pattern, not wrongdoing.
          </li>
          <li>
            <b>Interim orders are allegations.</b> In Scam watch, each case says whether SEBI's order is interim or final.
          </li>
          <li>
            <b>A few videos is a record, not a rating.</b> Small samples can make anyone look lucky or unlucky.
          </li>
        </ul>
      </section>

      <section className="ab-card">
        <h2>Built for the SerpApi hackathon</h2>
        <p>
          Receipts started as Watchlist, a watchlist app that flags unusual stock moves; its charts, signals and pre-made lists live on in{" "}
          <Link to="/receipts/watchlists">Watchlists</Link>. The code, including how every number is worked out, is on{" "}
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          . The public site runs on saved results, so browsing it never spends search credits.
        </p>
      </section>

      <section className="ab-credits">
        <h2>Credits</h2>
        <ul>
          <li>
            BSE, Dalal Street: BSEINDIA,{" "}
            <a href="https://commons.wikimedia.org/wiki/File:BSE_building_at_Dalal_Street.JPG" target="_blank" rel="noreferrer">
              CC BY-SA 3.0
            </a>
          </li>
          <li>
            SEBI Bhavan: Jimmy vikas,{" "}
            <a href="https://commons.wikimedia.org/wiki/File:SEBI_Bhavan.jpg" target="_blank" rel="noreferrer">
              CC BY-SA 3.0
            </a>
          </li>
          <li>
            Arshad Warsi: Bollywood Hungama,{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Arshad-Warsi.jpg" target="_blank" rel="noreferrer">
              CC BY 3.0
            </a>
          </li>
          <li>
            Jane Street logo: public domain, via{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Jane_Street_Capital_Logo.svg" target="_blank" rel="noreferrer">
              Wikimedia Commons
            </a>
          </li>
          <li>Creator pictures and video thumbnails load from YouTube.</li>
        </ul>
      </section>
    </article>
  );
}
