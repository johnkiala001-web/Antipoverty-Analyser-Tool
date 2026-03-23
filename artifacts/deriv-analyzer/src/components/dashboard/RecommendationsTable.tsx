import React from "react";
import { RecommendationRow } from "@/lib/math";
import { Check, Target } from "lucide-react";

interface RecommendationsTableProps {
  rows?: RecommendationRow[];
}

export function RecommendationsTable({ rows }: RecommendationsTableProps) {
  if (!rows || rows.length === 0) return null;

  const getConfidenceInfo = (prob: number) => {
    if (prob >= 0.7)
      return {
        label: "HIGH",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10 border-emerald-400/20",
        bar: "bg-emerald-500",
      };
    if (prob >= 0.55)
      return {
        label: "MEDIUM",
        color: "text-amber-400",
        bg: "bg-amber-400/10 border-amber-400/20",
        bar: "bg-amber-500",
      };
    return {
      label: "LOW",
      color: "text-rose-400",
      bg: "bg-rose-400/10 border-rose-400/20",
      bar: "bg-rose-500",
    };
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="p-5 border-b border-border bg-white/[0.02] flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-foreground tracking-widest uppercase flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            AI Trade Recommendations
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time computed probabilities based on momentum and volatility
          </p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white/[0.02] border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                Contract
              </th>
              <th className="px-6 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                Direction
              </th>
              <th className="px-6 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-widest w-64">
                Probability
              </th>
              <th className="px-6 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                Confidence
              </th>
              <th className="px-6 py-4 font-semibold text-xs text-muted-foreground uppercase tracking-widest text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, idx) => {
              const conf = getConfidenceInfo(row.probability);
              const percentage = (row.probability * 100).toFixed(1);

              return (
                <tr
                  key={idx}
                  className="hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <td className="px-6 py-4 font-medium text-foreground">
                    {row.contract}
                  </td>
                  <td className="px-6 py-4 font-mono">{row.direction}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm w-12">{percentage}%</span>
                      <div className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-border/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${conf.bar}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded border text-[10px] font-bold tracking-widest ${conf.bg} ${conf.color}`}
                    >
                      {conf.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {row.recommended ? (
                      <div className="mx-auto w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground/30">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
