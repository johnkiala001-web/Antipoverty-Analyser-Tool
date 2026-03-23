export interface Tick {
  epoch: number;
  quote: number;
}

export interface VolatilityMetrics {
  stdDev: number;
  atr: number;
  high: number;
  low: number;
  range: number;
}

export interface DigitStats {
  digitCounts: number[];
  digitProbs: number[];
  evenProb: number;
  oddProb: number;
  modalDigit: number;
  differProb: number;
}

export interface OverUnderStats {
  overProb: number;
  underProb: number;
}

export interface RecommendationRow {
  contract: string;
  direction: string;
  /** Full trade label: "Over 4", "Under 7", "Match 3", "Differs ≠ 3", "Even", "Odd" */
  tradeLabel: string;
  probability: number;
  recommended: boolean;
}

export interface AnalysisResult {
  volatility: VolatilityMetrics;
  digits: DigitStats;
  overUnder: OverUnderStats;
  recommendations: RecommendationRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DIGIT EXTRACTION
// Use the natural JavaScript string representation of the float so that
// trailing zeros added by toFixed() don't mislead the analysis.
// e.g. quote=106.7649 → "106.7649" → last char "9"   ✓
//      quote=106.7640 → JS stores as 106.764 → "106.764" → last char "4"
// This matches Deriv's actual tick precision far better than toFixed(5).
// ─────────────────────────────────────────────────────────────────────────────
export function extractLastDigit(quote: number): number {
  const s = quote.toString();
  const dot = s.indexOf(".");
  if (dot === -1) return Math.abs(Math.floor(quote)) % 10;
  // Last character in the natural decimal representation
  return parseInt(s[s.length - 1], 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// BARRIER SELECTION — picks a "meaningful" barrier
//
// Goal: a barrier where the estimated win probability is in [MIN, MAX],
// as close to TARGET as possible. This avoids trivially easy trades like
// "Under 1 (99%)" or "Over 8 (1%)".
//
// If no barrier falls in the sweet-spot, we broaden to FLOOR–CEILING.
// Last resort: pick the second-highest probability to avoid the extreme.
// ─────────────────────────────────────────────────────────────────────────────
const TARGET   = 0.58; // ideal win probability
const MIN_GOOD = 0.52; // sweet-spot lower bound
const MAX_GOOD = 0.80; // sweet-spot upper bound
const MIN_OK   = 0.38; // broader fallback lower
const MAX_OK   = 0.88; // broader fallback upper

interface BarrierResult { barrier: number; prob: number }

function pickBarrier(
  candidates: Array<{ x: number; prob: number }>
): BarrierResult {
  const annotated = candidates.map((c) => ({
    ...c,
    dist: Math.abs(c.prob - TARGET),
  }));

  // 1. Sweet-spot [MIN_GOOD, MAX_GOOD]
  const good = annotated.filter((c) => c.prob >= MIN_GOOD && c.prob <= MAX_GOOD);
  if (good.length > 0) {
    good.sort((a, b) => a.dist - b.dist);
    return { barrier: good[0].x, prob: good[0].prob };
  }

  // 2. Broader OK range [MIN_OK, MAX_OK]
  const ok = annotated.filter((c) => c.prob >= MIN_OK && c.prob <= MAX_OK);
  if (ok.length > 0) {
    ok.sort((a, b) => a.dist - b.dist);
    return { barrier: ok[0].x, prob: ok[0].prob };
  }

  // 3. Second-best (skip the extreme #1) so we avoid trivial suggestions
  annotated.sort((a, b) => b.prob - a.prob);
  const pick = annotated[1] ?? annotated[0];
  return { barrier: pick.x, prob: pick.prob };
}

function findOverBarrier(digitProbs: number[]): BarrierResult {
  const candidates = [];
  for (let x = 0; x <= 8; x++) {
    let prob = 0;
    for (let d = x + 1; d <= 9; d++) prob += digitProbs[d];
    candidates.push({ x, prob });
  }
  return pickBarrier(candidates);
}

function findUnderBarrier(digitProbs: number[]): BarrierResult {
  const candidates = [];
  for (let x = 1; x <= 9; x++) {
    let prob = 0;
    for (let d = 0; d < x; d++) prob += digitProbs[d];
    candidates.push({ x, prob });
  }
  return pickBarrier(candidates);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
export function computeAnalysis(ticks: Tick[]): AnalysisResult | null {
  if (ticks.length < 2) return null;

  const prices = ticks.map((t) => t.quote);
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // ── Volatility ─────────────────────────────────────────────────────────────
  const meanChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance =
    changes.reduce((a, b) => a + Math.pow(b - meanChange, 2), 0) / changes.length;
  const stdDev = Math.sqrt(variance);

  const trueRanges = changes.map(Math.abs);
  const atrWindow  = trueRanges.slice(-14);
  const atr = atrWindow.length
    ? atrWindow.reduce((a, b) => a + b, 0) / atrWindow.length
    : 0;

  const high  = Math.max(...prices);
  const low   = Math.min(...prices);
  const range = high - low;

  const volatility = { stdDev, atr, high, low, range };

  // ── Last-Digit Distribution ────────────────────────────────────────────────
  // Use extractLastDigit() which relies on the natural float string, not toFixed(5),
  // so digits like "9" in "106.7649" are captured instead of the padded "0".
  const lastDigits = prices.map(extractLastDigit);

  const digitCounts = Array(10).fill(0) as number[];
  lastDigits.forEach((d) => digitCounts[d]++);
  const total      = lastDigits.length;
  const digitProbs = digitCounts.map((c) => c / total);

  const evenCount =
    digitCounts[0] + digitCounts[2] + digitCounts[4] +
    digitCounts[6] + digitCounts[8];
  const evenProb = evenCount / total;
  const oddProb  = 1 - evenProb;

  let modalDigit = 0;
  let maxCount   = -1;
  digitCounts.forEach((c, i) => {
    if (c > maxCount) { maxCount = c; modalDigit = i; }
  });
  const differProb = 1 - digitProbs[modalDigit];

  const digitsStats: DigitStats = {
    digitCounts, digitProbs, evenProb, oddProb, modalDigit, differProb,
  };

  // ── Over / Under — smart barrier selection ─────────────────────────────────
  const overResult  = findOverBarrier(digitProbs);
  const underResult = findUnderBarrier(digitProbs);

  // Clamp
  const bestOverProb  = Math.max(0.01, Math.min(0.99, overResult.prob));
  const bestUnderProb = Math.max(0.01, Math.min(0.99, underResult.prob));

  const overUnder = { overProb: bestOverProb, underProb: bestUnderProb };

  // ── Recommendation Rows ────────────────────────────────────────────────────
  // For Even/Odd, if probabilities are very close, show 50% explicitly
  const evenIsRec  = evenProb >= oddProb;
  const overIsRec  = bestOverProb >= bestUnderProb;
  const matchIsRec = differProb < digitProbs[modalDigit];

  const recommendations: RecommendationRow[] = [
    {
      contract:    "Over/Under",
      direction:   "Over",
      tradeLabel:  `Over ${overResult.barrier}`,
      probability: bestOverProb,
      recommended: overIsRec,
    },
    {
      contract:    "Over/Under",
      direction:   "Under",
      tradeLabel:  `Under ${underResult.barrier}`,
      probability: bestUnderProb,
      recommended: !overIsRec,
    },
    {
      contract:    "Even/Odd",
      direction:   "Even",
      tradeLabel:  "Even",
      probability: evenProb,
      recommended: evenIsRec,
    },
    {
      contract:    "Even/Odd",
      direction:   "Odd",
      tradeLabel:  "Odd",
      probability: oddProb,
      recommended: !evenIsRec,
    },
    {
      contract:    "Matches/Differs",
      direction:   "Match",
      tradeLabel:  `Match ${modalDigit}`,
      probability: digitProbs[modalDigit],
      recommended: matchIsRec,
    },
    {
      contract:    "Matches/Differs",
      direction:   "Differs",
      tradeLabel:  `Differs ≠ ${modalDigit}`,
      probability: differProb,
      recommended: !matchIsRec,
    },
  ];

  return { volatility, digits: digitsStats, overUnder, recommendations };
}
