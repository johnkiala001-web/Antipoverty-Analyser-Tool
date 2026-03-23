import React from "react";
import { Tick } from "@/lib/math";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface ChartPanelProps {
  ticks: Tick[];
  symbol: string;
}

export function ChartPanel({ ticks, symbol }: ChartPanelProps) {
  if (ticks.length === 0) {
    return (
      <div className="terminal-card flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground font-mono text-sm">
          Awaiting market data...
        </p>
      </div>
    );
  }

  const currentPrice = ticks[ticks.length - 1].quote;
  const previousPrice = ticks.length > 1 ? ticks[ticks.length - 2].quote : currentPrice;
  const isUp = currentPrice >= previousPrice;

  const data = ticks.map((t) => ({
    time: t.epoch * 1000,
    price: t.quote,
  }));

  const minPrice = Math.min(...data.map((d) => d.price));
  const maxPrice = Math.max(...data.map((d) => d.price));
  const padding = (maxPrice - minPrice) * 0.1 || currentPrice * 0.0001;

  return (
    <div className="terminal-card flex flex-col min-h-[400px]">
      <div className="p-5 border-b border-border flex items-start justify-between bg-white/[0.02]">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            {symbol.replace("_", " ")}
          </h2>
          <div className="flex items-baseline gap-3">
            <span
              className={`text-4xl font-mono font-bold tracking-tight ${
                isUp ? "text-success" : "text-destructive"
              } text-shadow-glow`}
              style={{
                textShadow: isUp
                  ? "0 0 20px rgba(16, 185, 129, 0.3)"
                  : "0 0 20px rgba(239, 68, 68, 0.3)",
              }}
            >
              {formatPrice(currentPrice)}
            </span>
            <div
              className={`flex items-center text-sm font-mono font-medium px-2 py-0.5 rounded ${
                isUp
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isUp ? "▲" : "▼"}{" "}
              {formatPrice(Math.abs(currentPrice - previousPrice), 5)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isUp ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isUp ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              domain={["dataMin", "dataMax"]}
              type="number"
              tickFormatter={(unixTime) => format(unixTime, "HH:mm:ss")}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[minPrice - padding, maxPrice + padding]}
              tickFormatter={(val) => formatPrice(val, 2)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              orientation="right"
              tickCount={6}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card/95 backdrop-blur border border-border shadow-xl p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1 font-mono">
                        {format(payload[0].payload.time, "HH:mm:ss")}
                      </p>
                      <p className="text-lg font-mono font-bold text-foreground">
                        {formatPrice(payload[0].value as number)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isUp ? "hsl(var(--success))" : "hsl(var(--destructive))"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
              isAnimationActive={false}
              activeDot={{
                r: 6,
                fill: isUp ? "hsl(var(--success))" : "hsl(var(--destructive))",
                stroke: "hsl(var(--card))",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
