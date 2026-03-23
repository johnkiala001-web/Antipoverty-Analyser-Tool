import React from "react";
import { DigitStats } from "@/lib/math";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DigitCirclesProps {
  stats?: DigitStats;
  /** The last digit from the most recent tick — highlighted with amber pulse */
  lastDigit?: number;
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

          const circleBg = isEven
            ? `rgba(59, 130, 246, ${0.08 + intensity * 0.55})`
            : `rgba(168, 85, 247, ${0.08 + intensity * 0.55})`;

          const ringColor = isLast
            ? "#f59e0b"
            : isModal
            ? (isEven ? "#3b82f6" : "#a855f7")
            : "transparent";

          // Gauge colors
          const gaugeColor = isEven
            ? isModal ? "rgb(96,165,250)" : "rgba(59,130,246,0.75)"
            : isModal ? "rgb(192,132,252)" : "rgba(168,85,247,0.75)";

          const gaugeBg = isEven ? "rgba(59,130,246,0.10)" : "rgba(168,85,247,0.10)";

          return (
            <div key={digit} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              {/* Circle */}
              <div className="relative w-full aspect-square max-w-[52px]">
                {/* Pulse ring for last digit */}
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

                {/* Main circle */}
                <motion.div
                  layout
                  animate={{
                    background: circleBg,
                    borderColor: ringColor,
                    boxShadow: isModal
                      ? `0 0 16px 3px ${isEven ? "rgba(59,130,246,0.35)" : "rgba(168,85,247,0.35)"}`
                      : isLast
                      ? "0 0 12px 3px rgba(245,158,11,0.45)"
                      : "0 0 0 0 transparent",
                  }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 rounded-full flex items-center justify-center border-2 select-none cursor-default"
                >
                  <span
                    className={cn(
                      "font-mono font-bold text-base leading-none",
                      isModal
                        ? isEven ? "text-blue-300" : "text-purple-300"
                        : isLast
                        ? "text-amber-300"
                        : "text-foreground/80"
                    )}
                  >
                    {digit}
                  </span>
                </motion.div>
              </div>

              {/* ── Shifting Gauger ── */}
              {/* Track */}
              <div
                className="w-full h-3 rounded-full relative overflow-hidden"
                style={{ background: gaugeBg }}
              >
                {/* Animated fill */}
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{ background: gaugeColor }}
                  animate={{ width: `${pctNum}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.8 }}
                />

                {/* Moving tip marker */}
                <motion.div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-[5px] h-[14px] rounded-sm",
                    isLast ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" : "bg-white/80"
                  )}
                  animate={{ left: `calc(${pctNum}% - 2.5px)` }}
                  transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.8 }}
                />
              </div>

              {/* Percentage label — animates on change */}
              <motion.span
                key={Math.round(pctNum * 10)}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "font-mono text-[10px] tabular-nums text-center leading-none",
                  isModal
                    ? isEven ? "text-blue-400 font-bold" : "text-purple-400 font-bold"
                    : isLast
                    ? "text-amber-400 font-bold"
                    : "text-muted-foreground"
                )}
              >
                {pctNum.toFixed(1)}%
              </motion.span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500/60" />
          <span>Even (0,2,4,6,8)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500/60" />
          <span>Odd (1,3,5,7,9)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full border border-amber-400" />
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
