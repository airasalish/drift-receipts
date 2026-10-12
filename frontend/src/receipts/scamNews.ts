// Real enforcement stories. Headlines are our own one-line summaries (not the
// outlets' wording); every item links to the original report. `status`
// matters: interim orders are allegations, not final findings.

export interface ScamStory {
  id: string;
  amount: string;
  headline: string;
  outlet: string;
  date: string;
  status: "Interim order" | "Final order" | "Regulator action";
  kind: "Finfluencer" | "Pump-and-dump" | "Market manipulation" | "Regulation";
  url: string;
  match?: string[]; // lowercase creator/stock names this story is about
  hook?: string; // short attention line for the card; `headline` stays the factual summary
  who?: string; // the person or firm at the centre of the story
  image?: { src: string; kind: "avatar" | "photo" | "logo"; credit: string };
}

export const SCAM_STORIES: ScamStory[] = [
  {
    id: "sathe",
    amount: "₹546 cr",
    headline: "SEBI bars finfluencer Avadhut Sathe and his trading academy, impounding ₹546 crore over unregistered stock advice",
    hook: "SEBI bans a 9-lakh-subscriber finfluencer",
    who: "Avadhut Sathe",
    image: {"src": "https://yt3.ggpht.com/mIm_dgavQKTpER1TSskbRJGMdmdgI7YQXH2nEf1D3qbrBMv0U0VdJhXqgk8vcOPXkT1LKWwpxA=s240-c-k-c0x00ffffff-no-rj-mo", "kind": "avatar", "credit": "YouTube channel avatar"},
    outlet: "Outlook Money",
    date: "Dec 2025",
    status: "Interim order",
    kind: "Finfluencer",
    url: "https://www.outlookmoney.com/news/sebi-bars-finfluencer-avadhut-sathe-from-stock-market-impounds-over-rs-546-crore",
    match: ["avadhut sathe"],
  },
  {
    id: "jane-street",
    amount: "₹4,843 cr",
    headline: "SEBI accuses US trading firm Jane Street of manipulating Bank Nifty and freezes ₹4,843 crore",
    hook: "A US trading giant vs SEBI",
    who: "Jane Street",
    image: {"src": "/receipts/jane-street.svg", "kind": "logo", "credit": "Logo: public domain, via Wikimedia Commons"},
    outlet: "Business Today",
    date: "Jul 2025",
    status: "Interim order",
    kind: "Market manipulation",
    url: "https://www.businesstoday.in/amp/markets/story/sebi-cracks-down-on-jane-street-in-landmark-derivatives-market-case-484348-2025-07-11",
  },
  {
    id: "sadhna",
    amount: "₹58 cr",
    headline: "YouTube pump-and-dump in Sadhna Broadcast: 59 people and companies, including actor Arshad Warsi, told to return gains",
    hook: "A Bollywood actor, a YouTube channel, a ₹58 crore pump",
    who: "Arshad Warsi",
    image: {"src": "/receipts/arshad-warsi.jpg", "kind": "photo", "credit": "Photo: Bollywood Hungama, CC BY 3.0, via Wikimedia Commons"},
    outlet: "Business Today",
    date: "May 2025",
    status: "Final order",
    kind: "Pump-and-dump",
    url: "https://www.businesstoday.in/amp/markets/market-commentary/story/sebi-bars-actor-arshad-warsi-58-other-from-capital-markets-for-alleged-pump-dump-activities-478346-2025-05-30",
    match: ["sadhna broadcast", "crystal business"],
  },
  {
    id: "gupta",
    amount: "₹20 cr",
    headline: "Finfluencer and family barred over SME stocks pumped on X, WhatsApp and Telegram, then sold",
    hook: "Pumped on X, WhatsApp and Telegram, then sold",
    who: "A finfluencer family",
    outlet: "Free Press Journal",
    date: "2026",
    status: "Interim order",
    kind: "Pump-and-dump",
    url: "https://www.freepressjournal.in/business/sebi-bans-7-individuals-in-20-crore-stock-manipulation-case-linked-to-social-media-pump-and-dump-scheme",
  },
  {
    id: "baap-of-chart",
    amount: "₹17.2 cr",
    headline: "'Baap of Chart' barred for unregistered advice; SEBI moves to recover ₹18 crore after refunds went unpaid",
    hook: "SEBI comes to collect ₹18 crore",
    who: "Baap of Chart",
    image: {"src": "https://yt3.ggpht.com/HmgL2UydtvCUVzs27Z5gGSIj31XxXMJJ2Q1ulas0FkG3FBZqLcVfXgoDDk0J7Nzmz7bFwKJ6sQ=s240-c-k-c0x00ffffff-no-rj-mo", "kind": "avatar", "credit": "YouTube channel avatar"},
    outlet: "The Week (PTI)",
    date: "Dec 2025",
    status: "Regulator action",
    kind: "Finfluencer",
    url: "https://www.theweek.in/wire-updates/business/2025/12/16/dcm119-biz-sebi-baap-of-chart.html",
    match: ["baap of chart", "nasiruddin ansari"],
  },
  {
    id: "bharti",
    amount: "₹12 cr",
    headline: "YouTuber Ravindra Bharti's institute promised 25% to 1,000% returns; SEBI impounds ₹12 crore",
    hook: "Promised up to 1,000% returns",
    who: "Ravindra Bharti",
    outlet: "Storyboard18",
    date: "Apr 2024",
    status: "Interim order",
    kind: "Finfluencer",
    url: "https://www.storyboard18.com/how-it-works/sebi-orders-finfluencer-ravindra-balu-bharti-to-cough-up-rs-12-crore-made-through-unlawful-gains-28394.htm",
    match: ["ravindra bharti"],
  },
  {
    id: "unison",
    amount: "₹3.65 cr",
    headline: "Telegram stock-tip ring in Unison Metals: 17 penalised, including two promoters; their holding fell from 17% to under 2% in a month",
    hook: "Promoters' stake: 17% → under 2% in a month",
    who: "Unison Metals",
    outlet: "Moneylife",
    date: "2026",
    status: "Final order",
    kind: "Pump-and-dump",
    url: "https://moneylife.in/article/telegram-stocktip-scam-in-unison-metals-busted-sebi-imposes-365-crore-penalty-on-17-including-2-promoters/79584.html",
  },
  {
    id: "crackdown",
    amount: "New rules",
    headline: "SEBI moves against influencers giving misleading stock tips and return promises",
    hook: "SEBI draws a line for finfluencers",
    who: "SEBI",
    image: {"src": "/receipts/sebi-bhavan-1600.jpg", "kind": "photo", "credit": "SEBI Bhavan. Photo: Jimmy vikas, CC BY-SA 3.0"},
    outlet: "Business Standard",
    date: "Aug 2025",
    status: "Regulator action",
    kind: "Regulation",
    url: "https://www.business-standard.com/amp/finance/personal-finance/no-more-misleading-stock-tips-sebi-cracks-down-on-fraudulent-influencers-125082700154_1.html",
  },
];

export const storiesAbout = (name: string) => {
  const n = name.toLowerCase();
  return SCAM_STORIES.filter((s) => s.match?.some((m) => n.includes(m) || m.includes(n)));
};
