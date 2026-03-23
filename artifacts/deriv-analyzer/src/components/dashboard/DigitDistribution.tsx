import React from "react";
import { DigitStats } from "@/lib/math";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";

interface DigitDistributionProps {
  stats?: DigitStats;
}

export function DigitDistribution({ stats }: DigitDistributionProps) {
  if (!stats) return null;

  const data = stats.digitProbs.map((prob, i) => ({
    digit: i.toString(),
    percentage: prob * 100,
    isEven: i % 2 === 0,
    isModal: i === stats.modalDigit,
  }));

  const maxProb = Math.max(...data.map((d) => d.percentage));

  return (
    <div className="terminal-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase">
            Last-Digit Analysis
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Rolling frequency of terminal digit 0-9
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Even
            </span>
            <span className="font-mono text-sm text-blue-400 font-bold">
              {(stats.evenProb * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Odd
            </span>
            <span className="font-mono text-sm text-purple-400 font-bold">
              {(stats.oddProb * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="horizontal" margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
            <XAxis
              dataKey="digit"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "Fira Code" }}
            />
            <YAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => `${val}%`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "Fira Code" }}
              domain={[0, Math.ceil(maxProb + 5)]}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card/95 backdrop-blur border border-border shadow-xl p-3 rounded-lg font-mono">
                      <p className="text-xs text-muted-foreground mb-1">Digit {data.digit}</p>
                      <p className="text-sm font-bold text-foreground">
                        {data.percentage.toFixed(1)}%
                      </p>
                      {data.isModal && (
                        <p className="text-[10px] text-accent mt-1 uppercase">Most Frequent</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={10} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.3} />
            <Bar dataKey="percentage" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isEven ? "hsl(217, 91%, 60%)" : "hsl(280, 85%, 60%)"}
                  fillOpacity={entry.isModal ? 1 : 0.5}
                  stroke={entry.isModal ? "hsl(0, 0%, 100%)" : "transparent"}
                  strokeWidth={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
