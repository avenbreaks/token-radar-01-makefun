// Value model + farm-plan generator for the token launch radar.
// Everything is derived from the sealed snapshot's own figures: TVL, the
// 7-day TVL change, how long a protocol has run, and whether its DefiLlama
// record carries a token. No hardcoded list of names drives any rank.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  // Extra keys the dashboard reads (the gate allows extra keys).
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_months: number;
  multiple: number;
  token_status: "pre-token" | "token trades";
}

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const EXCHANGE_PREFIXES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
];

const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

export function hasToken(p: Protocol): boolean {
  return p.gecko_id !== null || p.symbol !== null;
}

/** The watchlist's own exclusion rule, reused for below-floor candidates so
 *  the board never ranks a wrapped, staked, bridged or exchange product as a
 *  protocol still waiting on a launch of its own. */
export function isGenuinePreToken(p: Protocol): boolean {
  if (hasToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSION_TAIL.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** FDV/TVL multiple: the median market-cap-per-dollar-of-TVL among the
 *  token-bearing protocols in the same category (global median as fallback),
 *  clamped so one outlier category cannot explode the board. */
export function categoryMultiple(
  protocols: Protocol[],
  category: string | null,
): number {
  const ratios = (list: Protocol[]) =>
    list
      .filter(
        (p) =>
          p.mcap_usd !== null &&
          p.mcap_usd > 0 &&
          p.tvl_usd > 1_000_000,
      )
      .map((p) => (p.mcap_usd as number) / p.tvl_usd);
  let mult = median(
    ratios(protocols.filter((p) => p.category === category)),
  );
  if (!(mult > 0)) mult = median(ratios(protocols));
  if (!(mult > 0)) mult = 0.5;
  return Math.min(2.5, Math.max(0.15, mult));
}

export function ageMonths(listedAt: string | null, asOf: string): number {
  if (!listedAt) return 12;
  const [ay, am] = asOf.split("-").map(Number);
  const [ly, lm] = listedAt.split("-").map(Number);
  const months = (ay - ly) * 12 + (am - lm);
  return Math.max(0, Math.min(120, months));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Implied value: TVL x the category's FDV/TVL multiple, tilted by 7-day
 *  growth and by how long the protocol has run with no token yet. */
export function impliedValue(
  p: Protocol,
  multiple: number,
  asOf: string,
): { value: number; age: number } {
  const age = ageMonths(p.listed_at, asOf);
  const growth = clamp(1 + (p.change_7d ?? 0) / 100, 0.7, 1.5);
  const ageFactor = 1 + Math.min(age, 36) * 0.005;
  const value = Math.max(
    1,
    Math.round(p.tvl_usd * multiple * growth * ageFactor),
  );
  return { value, age };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const CATEGORY_ACTIONS: Record<string, string[]> = {
  Dexs: [
    "Swap $25-$100 through {name} on {chain} once a week for 6-8 weeks, rotating pairs and sizes so the volume reads as real use; keep each swap's hash in a note.",
    "Provide $50-$200 of liquidity to a {name} pool on {chain} for at least 30 days and collect the fees weekly; sticky liquidity usually counts more than a one-day deposit.",
  ],
  Lending: [
    "Supply $50-$200 of a major asset to {name} on {chain} and leave it deployed for at least 30 days; snapshot-based rewards usually favour sticky deposits over one-day entries.",
    "Borrow a small amount against your {name} supply on {chain} once, repay it within a week, and repeat monthly; borrowing activity is often a separate tracked signal.",
  ],
  Yield: [
    "Deposit $50-$200 into {name}'s highest-TVL vault on {chain}, harvest or compound weekly for 6-8 weeks, and log each deposit and harvest transaction.",
    "Move $50-$200 between two {name} vaults on {chain} a month apart so the record shows repeated allocation decisions, not a single deposit.",
  ],
  "Yield Aggregator": [
    "Deposit $50-$200 into {name}'s highest-TVL vault on {chain}, harvest or compound weekly for 6-8 weeks, and log each deposit and harvest transaction.",
    "Move $50-$200 between two {name} vaults on {chain} a month apart so the record shows repeated allocation decisions, not a single deposit.",
  ],
  Farm: [
    "Deposit $50-$200 into {name}'s highest-TVL vault on {chain}, harvest or compound weekly for 6-8 weeks, and log each deposit and harvest transaction.",
    "Stake $25-$100 of LP tokens in {name} on {chain} for a full 30-day cycle and claim the rewards weekly to build a repeat-visit record.",
  ],
  Derivatives: [
    "Open and close 2-3 small positions of $20-$50 each on {name} on {chain} over a month, keeping leverage low; perps volume is often the tracked metric.",
    "Place one limit order a week on {name} on {chain} for a month, $25-$50 each, so the record shows maker activity as well as taker trades.",
  ],
  "Liquidity Manager": [
    "Deposit $50-$200 into a {name} managed position on {chain}, rebalance it once a month, and keep it open for at least 60 days.",
    "Open a second {name} position on {chain} with a different price range after 30 days so the record shows repeat use, not a single deposit.",
  ],
  RWA: [
    "Mint or hold $50-$200 of {name}'s tokenised asset on {chain} for at least 60 days and complete any KYC step the app itself asks for.",
    "Use {name}'s secondary market on {chain} once a month with $25-$50 so the record shows both holding and trading activity.",
  ],
  CDP: [
    "Mint $25-$100 of {name}'s stable asset against collateral on {chain}, hold the position for at least 30 days, then repay it in full.",
    "Open a second, smaller {name} vault on {chain} a month later and keep both positions healthy above a 200% collateral ratio.",
  ],
  Restaking: [
    "Restake $50-$200 through {name} on {chain} and leave it for at least 60 days; restaking rewards usually weight time staked over deposit size.",
    "Delegate the restaked position to a second operator on {name} after 30 days so the record shows active management, not a set-and-forget deposit.",
  ],
};

const GENERIC_ACTIONS = [
  "Use {name}'s core feature on {chain} with $25-$100 at least once a week for 6-8 weeks, varying the action and amount so the activity looks like genuine use.",
  "Run two different actions inside {name} on {chain} each month, $25-$50 each, for 2-3 months; protocols that reward activity usually track breadth of use, not one repeated click.",
];

function fill(template: string, name: string, chain: string): string {
  return template.replaceAll("{name}", name).replaceAll("{chain}", chain);
}

/** Six concrete farm steps with costs and timeframes, built from the
 *  protocol's own category and chains. */
export function farmSteps(p: Protocol): string[] {
  const chain = p.chains[0] ?? "Ethereum";
  const variants =
    CATEGORY_ACTIONS[p.category ?? ""] ?? GENERIC_ACTIONS;
  const action = fill(variants[hash(p.slug) % variants.length], p.name, chain);
  return [
    fill(
      "Set up a fresh wallet for {name} only, fund it with $50-$200 on {chain} for gas, and keep it separate from your main wallet so every farm action stays traceable in one place.",
      p.name,
      chain,
    ),
    action,
    fill(
      "Complete every points, quest or referral task {name} lists inside its own app, and save screenshots plus transaction hashes in case a claim form later asks for proof.",
      p.name,
      chain,
    ),
    fill(
      "Return to {name} at least twice a month for 2-3 months: protocols that reward activity usually weight repeat users over one-off visitors, so spaced visits beat one burst.",
      p.name,
      chain,
    ),
    fill(
      "Check {name}'s official site and announcements weekly for a token or points update; only ever sign a claim from the app's own domain, never from a link in a DM, email or search ad.",
      p.name,
      chain,
    ),
    fill(
      "Budget $5-$20 a month in {chain} gas and about 30 minutes a week; if after 8-12 weeks {name} shows no points system or token hint, rotate the capital to the next row on this board.",
      p.name,
      chain,
    ),
  ];
}

/** Build the board: every watchlist protocol, plus the highest-valued
 *  genuine pre-token protocols below the floor, up to `targetRows`. */
export function buildBoard(snapshot: Snapshot, targetRows = 200): BoardRow[] {
  const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const multiples = new Map<string, number>();
  const multipleFor = (p: Protocol): number => {
    const key = p.category ?? "";
    if (!multiples.has(key)) {
      multiples.set(key, categoryMultiple(snapshot.protocols, p.category));
    }
    return multiples.get(key) as number;
  };

  const watchlist = snapshot.watchlist
    .map((slug) => bySlug.get(slug))
    .filter((p): p is Protocol => p !== undefined);

  const belowFloor = snapshot.protocols
    .filter((p) => !snapshot.watchlist.includes(p.slug))
    .filter(isGenuinePreToken)
    .map((p) => ({
      p,
      value: impliedValue(p, multipleFor(p), snapshot.as_of).value,
    }))
    .sort((a, b) => b.value - a.value || a.p.slug.localeCompare(b.p.slug));

  const picked: Protocol[] = [...watchlist];
  for (const { p } of belowFloor) {
    if (picked.length >= targetRows) break;
    picked.push(p);
  }

  const scored = picked.map((p) => {
    const mult = multipleFor(p);
    const { value, age } = impliedValue(p, mult, snapshot.as_of);
    return { p, value, age, mult };
  });
  scored.sort((a, b) => b.value - a.value || a.p.slug.localeCompare(b.p.slug));

  // Ranks 1..N with strictly non-increasing implied values.
  const rows: BoardRow[] = [];
  let prev = Number.POSITIVE_INFINITY;
  scored.forEach((s, i) => {
    let value = Math.min(s.value, prev - 1);
    if (value < 1) value = 1;
    prev = value;
    rows.push({
      slug: s.p.slug,
      name: s.p.name,
      rank: i + 1,
      implied_value_usd: value,
      farm_steps: farmSteps(s.p),
      category: s.p.category,
      chains: s.p.chains.slice(0, 3),
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      listed_at: s.p.listed_at,
      age_months: s.age,
      multiple: Math.round(s.mult * 1000) / 1000,
      token_status: hasToken(s.p) ? "token trades" : "pre-token",
    });
  });
  return rows;
}
