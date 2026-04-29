import React, { useMemo } from "react";
import { DigitStats } from "@/lib/math";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DigitCirclesProps {
  stats?: DigitStats;
  lastDigit?: number;
}

// Rank 0 = lowest probability, rank 9 = highest probability
function getRanks(digitProbs: number[]): number[] {
  const indexed = digitProbs.map((p, i) => ({ p, i }));
  const sorted  = [...indexed].sort((a, b) => a.p - b.p);
  const ranks   = new Array(10).fill(0) as number[];
  sorted.forEach(({ i }, rank) => { ranks[i] = rank; });
  return ranks;
}

// Bar color based on rank (0=lowest, 9=highest)
function barColor(rank: number): string {
  if (rank === 9) return "#10b981"; // green — highest
  if (rank === 8) return "#3b82f6"; // blue  — 2nd highest
  if (rank === 1) return "#f97316"; // orange — 2nd lowest
  if (rank === 0) return "#ef4444"; // red   — lowest
  return "#64748b";                 // slate — middle ranks
}

// Background color for the circle
function circleBg(rank: number, isEven: boolean, intensity: number): string {
  if (rank === 9) return `rgba(16, 185, 129, ${0.12 + intensity * 0.40})`;
  if (rank === 8) return `rgba(59, 130, 246, ${0.10 + intensity * 0.38})`;
  if (rank === 1) return `rgba(249, 115, 22, ${0.10 + intensity * 0.30})`;
  if (rank === 0) return `rgba(239, 68, 68,  ${0.10 + intensity * 0.30})`;
  return isEven
    ? `rgba(59, 130, 246,  ${0.06 + intensity * 0.28})`
    : `rgba(168, 85, 247, ${0.06 + intensity * 0.28})`;
}

// Text color for the digit number
function digitTextClass(rank: number, isLast: boolean): string {
  if (isLast)  return "text-amber-300";
  if (rank === 9) return "text-emerald-300";
  if (rank === 8) return "text-blue-300";
  if (rank === 1) return "text-orange-300";
  if (rank === 0) return "text-red-400";
  return "text-foreground/75";
}

export function DigitCircles({ stats, lastDigit }: DigitCirclesProps) {
  if (!stats) {
    return (
      <div className="terminal-card p-5 flex flex-col gap-4 h-full">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase">
            Last-Digit Analysis
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Waiting for ticks…</p>
        </div>
        <div className="flex gap-2 justify-between mt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-border/30" />
              <div className="h-3 w-full rounded-full bg-white/5" />
              <div className="h-3 w-6 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxProb = Math.max(...stats.digitProbs);
  const ranks   = getRanks(stats.digitProbs);

  return (
    <div className="terminal-card p-5 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase">
            Last-Digit Analysis
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rolling frequency — digits 0–9
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Even
            </span>
            <motion.span
              key={stats.evenProb}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-sm text-blue-400 font-bold tabular-nums"
            >
              {(stats.evenProb * 100).toFixed(1)}%
            </motion.span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Odd
            </span>
            <motion.span
              key={stats.oddProb}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-sm text-purple-400 font-bold tabular-nums"
            >
              {(stats.oddProb * 100).toFixed(1)}%
            </motion.span>
          </div>
        </div>
      </div>

      {/* Digit Circles */}
      <div className="flex gap-1.5 justify-between">
        {stats.digitProbs.map((prob, digit) => {
          const isEven    = digit % 2 === 0;
          const isModal   = digit === stats.modalDigit;
          const isLast    = digit === lastDigit;
          const pctNum    = prob * 100;
          const intensity = maxProb > 0 ? prob / maxProb : 0;
          const rank      = ranks[digit];

          const bg       = circleBg(rank, isEven, intensity);
          const bar      = barColor(rank);

          const ringColor = isLast
            ? "#f59e0b"
            : rank === 9
            ? "#10b981"
            : rank === 8
            ? "#3b82f6"
            : rank === 0
            ? "#ef4444"
            : rank === 1
            ? "#f97316"
            : "transparent";

          return (
            <div key={digit} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              {/* ── Circle ── */}
              <div className="relative w-full aspect-square max-w-[52px]">
                {/* Pulse ring on last tick digit */}
                <AnimatePresence>
                  {isLast && (
                    <motion.div
                      key={`pulse-${lastDigit}`}
                      className="absolute inset-0 rounded-full border-2 border-amber-400"
                      initial={{ scale: 1, opacity: 0.9 }}
                      animate={{ scale: 1.7, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>

                {/* SVG arc progress ring */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 44 44"
                >
                  {/* Track */}
                  <circle
                    cx="22" cy="22" r="19"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="2.5"
                  />
                  {/* Fill arc */}
                  <motion.circle
                    cx="22" cy="22" r="19"
                    fill="none"
                    stroke={bar}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 19}
                    animate={{
                      strokeDashoffset: 2 * Math.PI * 19 * (1 - prob),
                      opacity: prob > 0 ? 1 : 0,
                    }}
                    transition={{ type: "spring" as const, stiffness: 90, damping: 18 }}
                  />
                </svg>

                {/* Main circle body */}
                <motion.div
                  layout
                  animate={{
                    background: bg,
                    borderColor: ringColor,
                    boxShadow: isLast
                      ? "0 0 14px 3px rgba(245,158,11,0.5)"
                      : isModal
                      ? `0 0 14px 3px ${bar}55`
                      : "0 0 0 0 transparent",
                  }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-[5px] rounded-full flex items-center justify-center border select-none cursor-default"
                >
                  <span className={cn("font-mono font-bold text-base leading-none", digitTextClass(rank, isLast))}>
                    {digit}
                  </span>
                </motion.div>
              </div>

              {/* ── Horizontal bar with moving cursor ── */}
              <div
                className="w-full h-[5px] rounded-full relative overflow-visible"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {/* Animated fill */}
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{ background: bar }}
                  animate={{ width: `${pctNum}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.8 }}
                />

                {/* Moving cursor marker */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-[5px] h-[13px] rounded-sm shadow-md"
                  style={{
                    background: isLast ? "#f59e0b" : "#ffffff",
                    boxShadow: isLast
                      ? "0 0 6px rgba(245,158,11,0.9)"
                      : "0 0 4px rgba(255,255,255,0.5)",
                  }}
                  animate={{ left: `calc(${pctNum}% - 2.5px)` }}
                  transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.8 }}
                />
              </div>

              {/* ── Percentage label ── */}
              <motion.span
                key={Math.round(pctNum * 100)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22 }}
                className="font-mono text-[10px] tabular-nums text-center leading-none font-semibold"
                style={{ color: isLast ? "#f59e0b" : bar }}
              >
                {pctNum.toFixed(2)}%
              </motion.span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-emerald-400">Highest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-blue-400">2nd Highest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span className="text-orange-400">2nd Lowest</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-red-400">Lowest</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full border border-amber-400" />
          <span className="text-amber-400">Last tick digit</span>
        </div>
      </div>
    </div>
  );
}
