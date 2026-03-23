import React from "react";
import { VolatilityMetrics } from "@/lib/math";
import { formatPrice } from "@/lib/utils";
import { Activity, Zap, Maximize, Minimize, MoveVertical } from "lucide-react";

interface MetricsPanelProps {
  metrics?: VolatilityMetrics;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) return null;

  const items = [
    {
      label: "Std Dev",
      value: formatPrice(metrics.stdDev, 5),
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "ATR (14)",
      value: formatPrice(metrics.atr, 5),
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "High",
      value: formatPrice(metrics.high, 3),
      icon: Maximize,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Low",
      value: formatPrice(metrics.low, 3),
      icon: Minimize,
      color: "text-rose-400",
      bg: "bg-rose-400/10",
    },
    {
      label: "Range",
      value: formatPrice(metrics.range, 4),
      icon: MoveVertical,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="terminal-card p-4 flex items-center gap-4 hover:border-primary/30 transition-colors duration-300"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.bg}`}>
              <Icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {item.label}
              </p>
              <p className="text-base font-mono font-bold text-foreground">
                {item.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
