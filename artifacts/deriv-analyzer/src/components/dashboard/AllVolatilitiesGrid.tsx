import React from "react";
import { useMultiSymbol } from "@/hooks/use-multi-symbol";
import { AnalysisResult } from "@/lib/math";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2, TrendingUp, TrendingDown } from "lucide-react";

// All volatility symbols to monitor
const VOL_SYMBOLS = [
  { id: "R_10",    label: "V10",       subtitle: "Volatility 10" },
  { id: "R_25",    label: "V25",       subtitle: "Volatility 25" },
  { id: "R_50",    label: "V50",       subtitle: "Volatility 50" },
  { id: "R_75",    label: "V75",       subtitle: "Volatility 75" },
  { id: "R_100",   label: "V100",      subtitle: "Volatility 100" },
  { id: "1HZ10V",  label: "V10 (1s)",  subtitle: "Volatility 10 (1s)" },
  { id: "1HZ25V",  label: "V25 (1s)",  subtitle: "Volatility 25 (1s)" },
  { id: "1HZ50V",  label: "V50 (1s)",  subtitle: "Volatility 50 (1s)" },
  { id: "1HZ75V",  label: "V75 (1s)",  subtitle: "Volatility 75 (1s)" },
  { id: "1HZ100V", label: "V100 (1s)", subtitle: "Volatility 100 (1s)" },
];

const ALL_SYMBOL_IDS = VOL_SYMBOLS.map((s) => s.id);

/** Extract the single best recommendation trade label from analysis */
function getBestTrade(analysis: AnalysisResult | null): {
  label: string;
  prob: number;
  type: "over" | "under" | "even" | "odd" | "match" | "differs" | null;
} | null {
  if (!analysis) return null;
  const best = analysis.recommendations
    .filter((r) => r.recommended)
    .sort((a, b) => b.probability - a.probability)[0];
  if (!best) return null;
  const dir = best.direction.toLowerCase();
  const type =
    dir === "over"    ? "over"    :
    dir === "under"   ? "under"   :
    dir === "even"    ? "even"    :
    dir === "odd"     ? "odd"     :
    dir === "match"   ? "match"   :
    dir === "differs" ? "differs" : null;
  return { label: best.tradeLabel, prob: best.probability, type };
}

function confidenceColor(prob: number) {
  if (prob >= 0.7) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (prob >= 0.55) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  return "text-rose-400 border-rose-500/40 bg-rose-500/10";
}

function DigitRow({ probs, lastDigit }: { probs: number[]; lastDigit: number | null }) {
  const maxP = Math.max(...probs);
  return (
    <div className="flex gap-[3px] w-full">
      {probs.map((p, d) => {
        const isEven  = d % 2 === 0;
        const isModal = p === maxP && p > 0;
        const isLast  = d === lastDigit;
        const opacity = maxP > 0 ? 0.15 + (p / maxP) * 0.75 : 0.15;
        return (
          <div
            key={d}
            title={`Digit ${d}: ${(p * 100).toFixed(1)}%`}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 cursor-default",
            )}
          >
            {/* Circle */}
            <div
              className={cn(
                "w-full aspect-square rounded-full flex items-center justify-center border",
                "transition-all duration-300 text-[9px] font-bold font-mono",
                isLast
                  ? "border-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]"
                  : isModal
                  ? isEven
                    ? "border-blue-400"
                    : "border-purple-400"
                  : "border-transparent"
              )}
              style={{
                background: isEven
                  ? `rgba(59,130,246,${opacity})`
                  : `rgba(168,85,247,${opacity})`,
                color: isModal
                  ? isEven ? "#93c5fd" : "#d8b4fe"
                  : "#94a3b8",
              }}
            >
              {d}
            </div>
            {/* % label */}
            <span
              className={cn(
                "text-[8px] font-mono tabular-nums leading-none",
                isModal
                  ? isEven ? "text-blue-400" : "text-purple-400"
                  : "text-muted-foreground/60"
              )}
            >
              {(p * 100).toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AllVolatilitiesGrid() {
  const { status, data } = useMultiSymbol(ALL_SYMBOL_IDS);

  return (
    <div className="terminal-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border bg-white/[0.02] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            All Volatilities — Live Predictions
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Digit circles + best trade recommendation for every volatility index
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {status === "connected" ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">LIVE</span>
            </>
          ) : status === "connecting" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-400">CONNECTING</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400">OFFLINE</span>
            </>
          )}
        </div>
      </div>

      {/* Grid of volatility cards */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {VOL_SYMBOLS.map(({ id, label, subtitle }) => {
          const sym       = data[id];
          const analysis  = sym?.analysis ?? null;
          const probs     = analysis?.digits.digitProbs ?? Array(10).fill(0);
          const lastDigit = sym?.lastDigit ?? null;
          const price     = sym?.currentPrice;
          const tickCount = sym?.ticks.length ?? 0;
          const best      = getBestTrade(analysis);

          // Over/Under/Matches/Differs specific predictions
          const recs = analysis?.recommendations ?? [];
          const overRec  = recs.find((r) => r.direction === "Over");
          const underRec = recs.find((r) => r.direction === "Under");
          const matchRec = recs.find((r) => r.direction === "Match");
          const diffRec  = recs.find((r) => r.direction === "Differs");
          const evenRec  = recs.find((r) => r.direction === "Even");
          const oddRec   = recs.find((r) => r.direction === "Odd");

          return (
            <div
              key={id}
              className="terminal-card border border-border/60 rounded-xl p-3 flex flex-col gap-2.5 hover:border-primary/30 transition-colors duration-200"
            >
              {/* Card title row */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-[13px] text-foreground">{label}</span>
                  <p className="text-[9px] text-muted-foreground/60 leading-tight">{subtitle}</p>
                </div>
                {price != null ? (
                  <span className="font-mono text-[11px] text-foreground/80 tabular-nums">
                    {price.toFixed(3)}
                  </span>
                ) : (
                  <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                )}
              </div>

              {/* Digit circles 0–9 */}
              <DigitRow probs={probs} lastDigit={lastDigit} />

              {/* Tick count */}
              <div className="flex justify-between text-[9px] text-muted-foreground/50 font-mono">
                <span>{tickCount} ticks</span>
                {lastDigit !== null && (
                  <span className="text-amber-400">last: {lastDigit}</span>
                )}
              </div>

              {/* Predictions */}
              {analysis ? (
                <div className="flex flex-col gap-1 border-t border-border/30 pt-2">
                  {/* Over / Under */}
                  <div className="flex gap-1">
                    {[overRec, underRec].map((rec) =>
                      rec ? (
                        <span
                          key={rec.tradeLabel}
                          className={cn(
                            "flex-1 text-center text-[9px] font-mono font-bold px-1 py-0.5 rounded border truncate",
                            rec.recommended
                              ? confidenceColor(rec.probability) + " ring-1 ring-current/20"
                              : "text-muted-foreground/40 border-border/30 bg-transparent"
                          )}
                          title={`${rec.tradeLabel} — ${(rec.probability * 100).toFixed(1)}%`}
                        >
                          {rec.tradeLabel}
                        </span>
                      ) : null
                    )}
                  </div>

                  {/* Even / Odd */}
                  <div className="flex gap-1">
                    {[evenRec, oddRec].map((rec) =>
                      rec ? (
                        <span
                          key={rec.tradeLabel}
                          className={cn(
                            "flex-1 text-center text-[9px] font-mono font-bold px-1 py-0.5 rounded border truncate",
                            rec.recommended
                              ? confidenceColor(rec.probability) + " ring-1 ring-current/20"
                              : "text-muted-foreground/40 border-border/30 bg-transparent"
                          )}
                          title={`${rec.tradeLabel} — ${(rec.probability * 100).toFixed(1)}%`}
                        >
                          {rec.tradeLabel}
                        </span>
                      ) : null
                    )}
                  </div>

                  {/* Match / Differs */}
                  <div className="flex gap-1">
                    {[matchRec, diffRec].map((rec) =>
                      rec ? (
                        <span
                          key={rec.tradeLabel}
                          className={cn(
                            "flex-1 text-center text-[9px] font-mono font-bold px-1 py-0.5 rounded border truncate",
                            rec.recommended
                              ? confidenceColor(rec.probability) + " ring-1 ring-current/20"
                              : "text-muted-foreground/40 border-border/30 bg-transparent"
                          )}
                          title={`${rec.tradeLabel} — ${(rec.probability * 100).toFixed(1)}%`}
                        >
                          {rec.tradeLabel}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t border-border/30 pt-2">
                  <div className="text-[9px] text-muted-foreground/50 text-center animate-pulse">
                    Loading predictions…
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
