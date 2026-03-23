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
  /** The specific trade label, e.g. "Over 3", "Under 6", "Match 7", "Differs ≠ 4" */
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

export function computeAnalysis(ticks: Tick[]): AnalysisResult | null {
  if (ticks.length < 2) return null;

  const prices = ticks.map((t) => t.quote);
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // ─── Volatility ────────────────────────────────────────────────────────────
  const meanChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance =
    changes.reduce((a, b) => a + Math.pow(b - meanChange, 2), 0) /
    changes.length;
  const stdDev = Math.sqrt(variance);

  const trueRanges = changes.map(Math.abs);
  const atrWindow = trueRanges.slice(-14);
  const atr = atrWindow.length
    ? atrWindow.reduce((a, b) => a + b, 0) / atrWindow.length
    : 0;

  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const range = high - low;

  const volatility = { stdDev, atr, high, low, range };

  // ─── Last-Digit Analysis ───────────────────────────────────────────────────
  // Extract the last decimal digit from each price using 5dp string representation
  const lastDigits = prices.map((p) => {
    const s = p.toFixed(5);
    return parseInt(s[s.length - 1], 10);
  });

  const digitCounts = Array(10).fill(0) as number[];
  lastDigits.forEach((d) => digitCounts[d]++);
  const total = lastDigits.length;
  const digitProbs = digitCounts.map((c) => c / total);

  const evenCount =
    digitCounts[0] + digitCounts[2] + digitCounts[4] +
    digitCounts[6] + digitCounts[8];
  const evenProb = evenCount / total;
  const oddProb = 1 - evenProb;

  // Modal digit = most frequently occurring last digit
  let modalDigit = 0;
  let maxCount = -1;
  digitCounts.forEach((c, i) => {
    if (c > maxCount) {
      maxCount = c;
      modalDigit = i;
    }
  });
  const differProb = 1 - digitProbs[modalDigit];

  const digitsStats: DigitStats = {
    digitCounts,
    digitProbs,
    evenProb,
    oddProb,
    modalDigit,
    differProb,
  };

  // ─── Over/Under Barrier Selection ──────────────────────────────────────────
  // "Over X" wins when the next tick's last digit is STRICTLY GREATER than X.
  //   Valid barriers for Over: 0–8  (Over 9 is impossible — no digit > 9)
  //   P(Over X) = sum of digitProbs[X+1 .. 9]
  //
  // "Under X" wins when the next tick's last digit is STRICTLY LESS than X.
  //   Valid barriers for Under: 1–9  (Under 0 is impossible — no digit < 0)
  //   P(Under X) = sum of digitProbs[0 .. X-1]
  //
  // We pick the barrier that maximises the win probability in each direction.

  let bestOverBarrier = 0;
  let bestOverProb = 0;
  for (let x = 0; x <= 8; x++) {
    let prob = 0;
    for (let d = x + 1; d <= 9; d++) prob += digitProbs[d];
    if (prob > bestOverProb) {
      bestOverProb = prob;
      bestOverBarrier = x;
    }
  }

  let bestUnderBarrier = 9;
  let bestUnderProb = 0;
  for (let x = 1; x <= 9; x++) {
    let prob = 0;
    for (let d = 0; d < x; d++) prob += digitProbs[d];
    if (prob > bestUnderProb) {
      bestUnderProb = prob;
      bestUnderBarrier = x;
    }
  }

  // Clamp to avoid degenerate display
  bestOverProb = Math.max(0.01, Math.min(0.99, bestOverProb));
  bestUnderProb = Math.max(0.01, Math.min(0.99, bestUnderProb));

  const overUnder = { overProb: bestOverProb, underProb: bestUnderProb };

  // ─── Recommendation Rows ───────────────────────────────────────────────────
  const overIsRec = bestOverProb >= bestUnderProb;

  const recommendations: RecommendationRow[] = [
    {
      contract: "Over/Under",
      direction: "Over",
      tradeLabel: `Over ${bestOverBarrier}`,
      probability: bestOverProb,
      recommended: overIsRec,
    },
    {
      contract: "Over/Under",
      direction: "Under",
      tradeLabel: `Under ${bestUnderBarrier}`,
      probability: bestUnderProb,
      recommended: !overIsRec,
    },
    {
      contract: "Even/Odd",
      direction: "Even",
      tradeLabel: "Even",
      probability: evenProb,
      recommended: evenProb >= oddProb,
    },
    {
      contract: "Even/Odd",
      direction: "Odd",
      tradeLabel: "Odd",
      probability: oddProb,
      recommended: oddProb > evenProb,
    },
    {
      contract: "Matches/Differs",
      direction: "Match",
      // Recommend matching the modal digit — it has appeared most often
      tradeLabel: `Match ${modalDigit}`,
      probability: digitProbs[modalDigit],
      recommended: differProb < digitProbs[modalDigit],
    },
    {
      contract: "Matches/Differs",
      direction: "Differs",
      // Recommend differing from the modal digit — anything else is more likely
      tradeLabel: `Differs ≠ ${modalDigit}`,
      probability: differProb,
      recommended: differProb >= digitProbs[modalDigit],
    },
  ];

  return { volatility, digits: digitsStats, overUnder, recommendations };
}
