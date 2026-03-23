import React, { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { ChartPanel } from "@/components/dashboard/ChartPanel";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { DigitDistribution } from "@/components/dashboard/DigitDistribution";
import { RecommendationsTable } from "@/components/dashboard/RecommendationsTable";
import { useDerivWebSocket } from "@/hooks/use-deriv-ws";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [symbol, setSymbol] = useState("R_50");
  const { status, ticks, analysis, reconnectCount } = useDerivWebSocket(symbol);

  // Stagger children animations
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

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
          {/* Top Row: Metrics */}
          <motion.div variants={item}>
            <MetricsPanel metrics={analysis?.volatility} />
          </motion.div>

          {/* Middle Row: Chart & Digits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={item} className="lg:col-span-2">
              <ChartPanel ticks={ticks} symbol={symbol} />
            </motion.div>
            <motion.div variants={item} className="lg:col-span-1">
              <DigitDistribution stats={analysis?.digits} />
            </motion.div>
          </div>

          {/* Bottom Row: AI Recommendations */}
          <motion.div variants={item}>
            <RecommendationsTable rows={analysis?.recommendations} />
          </motion.div>
        </motion.div>
      </main>

      {/* Footer Status */}
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
              <span className="text-warning">Reconnects: {reconnectCount}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
