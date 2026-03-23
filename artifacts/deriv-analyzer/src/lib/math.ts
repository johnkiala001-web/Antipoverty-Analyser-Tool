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

  // Volatility
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

  // Last-Digit Analysis
  const digits = prices.map((p) => {
    const s = p.toFixed(5);
    return parseInt(s[s.length - 1], 10);
  });

  const digitCounts = Array(10).fill(0);
  digits.forEach((d) => digitCounts[d]++);
  const total = digits.length;
  const digitProbs = digitCounts.map((c) => c / total);

  const evenCount =
    digitCounts[0] +
    digitCounts[2] +
    digitCounts[4] +
    digitCounts[6] +
    digitCounts[8];
  const evenProb = evenCount / total;
  const oddProb = 1 - evenProb;

  let modalDigit = 0;
  let maxCount = -1;
  digitCounts.forEach((c, i) => {
    if (c > maxCount) {
      maxCount = c;
      modalDigit = i;
    }
  });
  const differProb = 1 - digitProbs[modalDigit];

  const digitsStats = {
    digitCounts,
    digitProbs,
    evenProb,
    oddProb,
    modalDigit,
    differProb,
  };

  // Over/Under Analysis
  const upCount = changes.filter((c) => c > 0).length;
  const downCount = changes.filter((c) => c < 0).length;
  const totalMoves = upCount + downCount;
  const momentumUp = totalMoves === 0 ? 0.5 : upCount / totalMoves;

  const current = prices[prices.length - 1];
  const positionInRange = range > 0 ? (current - low) / range : 0.5;
  const meanRevUp = 1 - positionInRange;

  let overProb = 0.5 * momentumUp + 0.5 * meanRevUp;
  overProb = Math.max(0.01, Math.min(0.99, overProb));
  const underProb = 1 - overProb;

  const overUnder = { overProb, underProb };

  // Generate Recommendation Rows
  const recommendations: RecommendationRow[] = [
    {
      contract: "Over/Under",
      direction: "Over",
      probability: overProb,
      recommended: overProb >= underProb,
    },
    {
      contract: "Over/Under",
      direction: "Under",
      probability: underProb,
      recommended: underProb > overProb,
    },
    {
      contract: "Even/Odd",
      direction: "Even",
      probability: evenProb,
      recommended: evenProb >= oddProb,
    },
    {
      contract: "Even/Odd",
      direction: "Odd",
      probability: oddProb,
      recommended: oddProb > evenProb,
    },
    {
      contract: "Matches/Differs",
      direction: `Match ${modalDigit}`,
      probability: digitProbs[modalDigit],
      recommended: differProb < digitProbs[modalDigit],
    },
    {
      contract: "Matches/Differs",
      direction: "Differs",
      probability: differProb,
      recommended: differProb >= digitProbs[modalDigit],
    },
  ];

  return { volatility, digits: digitsStats, overUnder, recommendations };
}
