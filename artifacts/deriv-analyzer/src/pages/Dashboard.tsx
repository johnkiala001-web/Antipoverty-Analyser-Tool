import React, { useMemo, useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { ChartPanel } from "@/components/dashboard/ChartPanel";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { DigitCircles } from "@/components/dashboard/DigitCircles";
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable";
import { AllVolatilitiesGrid } from "@/components/dashboard/AllVolatilitiesGrid";
import { useDerivWebSocket } from "@/hooks/use-deriv-ws";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 22 } },
};

export default function Dashboard() {
  const [symbol, setSymbol] = useState("R_50");
  const { status, ticks, analysis, reconnectCount } = useDerivWebSocket(symbol);

  // Derive the last digit from the most recent tick for the digit circle highlight
  const lastDigit = useMemo(() => {
    if (ticks.length === 0) return undefined;
    const quote = ticks[ticks.length - 1].quote;
    return parseInt(quote.toFixed(5).slice(-1), 10);
  }, [ticks]);

  return (
    <div className="min-h-screen bg-background bg-grid-pattern relative">
      <div className="absolute inset-0 bg-scanlines z-50 pointer-events-none opacity-[0.15]" />

      <Header
        symbol={symbol}
        onSymbolChange={setSymbol}
        status={status}
        tickCount={ticks.length}
      />

      <main className="w-full max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8 relative z-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Row 1: Volatility metric cards */}
          <motion.div variants={item}>
            <MetricsPanel metrics={analysis?.volatility} />
          </motion.div>

          {/* Row 2: Live price chart (left 2/3) + digit circles (right 1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={item} className="lg:col-span-2">
              <ChartPanel ticks={ticks} symbol={symbol} />
            </motion.div>
            <motion.div variants={item} className="lg:col-span-1">
              <DigitCircles stats={analysis?.digits} lastDigit={lastDigit} />
            </motion.div>
          </div>

          {/* Row 3: AI recommendations for the selected symbol */}
          <motion.div variants={item}>
            <RecommendationsTable rows={analysis?.recommendations} />
          </motion.div>

          {/* Row 4: All volatility indices — digit circles + predictions */}
          <motion.div variants={item}>
            <AllVolatilitiesGrid />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 bg-background/80 backdrop-blur mt-auto">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between text-[11px] text-muted-foreground font-mono uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span>Terminal V1.0.0</span>
            <span className="hidden sm:inline">Engine: Replit Agent</span>
          </div>
          <div className="flex items-center gap-6">
            {ticks.length > 0 && (
              <span>
                Last Update:{" "}
                <span className="text-foreground">
                  {new Date(ticks[ticks.length - 1].epoch * 1000).toLocaleTimeString()}
                </span>
              </span>
            )}
            {reconnectCount > 0 && (
              <span className="text-amber-400">Reconnects: {reconnectCount}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
