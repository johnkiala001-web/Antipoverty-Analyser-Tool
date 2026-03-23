import React from "react";
import { DigitStats } from "@/lib/math";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DigitCirclesProps {
  stats?: DigitStats;
  /** The very last digit from the most recent tick — highlighted with a pulse ring */
  lastDigit?: number;
}

export function DigitCircles({ stats, lastDigit }: DigitCirclesProps) {
  if (!stats) {
    // Loading skeleton
    return (
      <div className="terminal-card p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase">
            Last-Digit Analysis
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Waiting for ticks…</p>
        </div>
        <div className="flex gap-2 justify-between mt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-2 animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 border border-border/30" />
              <div className="h-3 w-6 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxProb = Math.max(...stats.digitProbs);

  return (
    <div className="terminal-card p-5 flex flex-col gap-4">
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Even</span>
            <span className="font-mono text-sm text-blue-400 font-bold">
              {(stats.evenProb * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Odd</span>
            <span className="font-mono text-sm text-purple-400 font-bold">
              {(stats.oddProb * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Digit Circles */}
      <div className="flex gap-1.5 justify-between mt-1">
        {stats.digitProbs.map((prob, digit) => {
          const isEven    = digit % 2 === 0;
          const isModal   = digit === stats.modalDigit;
          const isLast    = digit === lastDigit;
          const pct       = (prob * 100).toFixed(1);
          // Intensity: 0 when prob=0, 1 when prob=maxProb
          const intensity = maxProb > 0 ? prob / maxProb : 0;

          // Circle background: blue for even, purple for odd — brightness driven by frequency
          const circleBg = isEven
            ? `rgba(59, 130, 246, ${0.08 + intensity * 0.55})`  // blue
            : `rgba(168, 85, 247, ${0.08 + intensity * 0.55})`; // purple

          const ringColor = isModal
            ? isEven ? "#3b82f6" : "#a855f7"
            : isLast
            ? "#f59e0b"
            : "transparent";

          return (
            <div key={digit} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              {/* Circle */}
              <div className="relative w-full aspect-square max-w-[52px]">
                {/* Last-digit pulse ring */}
                <AnimatePresence>
                  {isLast && (
                    <motion.div
                      key={`pulse-${digit}`}
                      className="absolute inset-0 rounded-full border-2 border-amber-400"
                      initial={{ scale: 1, opacity: 0.9 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  )}
                </AnimatePresence>

                {/* Main circle */}
                <motion.div
                  layout
                  className={cn(
                    "absolute inset-0 rounded-full flex items-center justify-center",
                    "border-2 transition-all duration-300 select-none cursor-default"
                  )}
                  style={{
                    background: circleBg,
                    borderColor: ringColor,
                    boxShadow: isModal
                      ? `0 0 12px 2px ${isEven ? "rgba(59,130,246,0.4)" : "rgba(168,85,247,0.4)"}`
                      : isLast
                      ? "0 0 10px 2px rgba(245,158,11,0.5)"
                      : "none",
                  }}
                >
                  <span
                    className={cn(
                      "font-mono font-bold text-base leading-none",
                      isModal
                        ? isEven ? "text-blue-300" : "text-purple-300"
                        : "text-foreground/80"
                    )}
                  >
                    {digit}
                  </span>
                </motion.div>
              </div>

              {/* Percentage label */}
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums text-center leading-none",
                  isModal
                    ? isEven ? "text-blue-400 font-bold" : "text-purple-400 font-bold"
                    : "text-muted-foreground"
                )}
              >
                {pct}%
              </span>

              {/* Mini frequency bar */}
              <div className="w-full h-0.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isEven ? "bg-blue-500/60" : "bg-purple-500/60"
                  )}
                  style={{ width: `${intensity * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/60" />
          <span>Even (0,2,4,6,8)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500/60" />
          <span>Odd (1,3,5,7,9)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full border border-current text-amber-400" />
          <span className="text-amber-400">Last tick digit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-400" />
          <span>Most frequent</span>
        </div>
      </div>
    </div>
  );
}
