import React from "react";
import { Activity, Wifi, WifiOff, Loader2 } from "lucide-react";
import { SymbolSelect } from "@/components/SymbolSelect";
import { ConnectionStatus } from "@/hooks/use-deriv-ws";
import { cn } from "@/lib/utils";

interface HeaderProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  status: ConnectionStatus;
  tickCount: number;
}

export function Header({
  symbol,
  onSymbolChange,
  status,
  tickCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="w-full max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight leading-tight">
                Deriv AI
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest leading-none">
                Terminal
              </p>
            </div>
          </div>
          <div className="h-6 w-px bg-border hidden sm:block"></div>
          <div className="hidden sm:block">
            <SymbolSelect value={symbol} onChange={onSymbolChange} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Ticks Processed
            </span>
            <span className="text-sm font-mono font-medium text-foreground">
              {tickCount}
            </span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-colors duration-300",
              status === "connected" &&
                "bg-success/10 border-success/20 text-success shadow-success/5",
              status === "connecting" &&
                "bg-warning/10 border-warning/20 text-warning shadow-warning/5",
              status === "disconnected" &&
                "bg-destructive/10 border-destructive/20 text-destructive shadow-destructive/5"
            )}
          >
            {status === "connected" && <Wifi className="w-3.5 h-3.5" />}
            {status === "connecting" && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            {status === "disconnected" && <WifiOff className="w-3.5 h-3.5" />}
            <span className="uppercase tracking-wider">
              {status === "connected"
                ? "Live"
                : status === "connecting"
                ? "Connecting"
                : "Offline"}
            </span>
          </div>
        </div>
      </div>
      
      {/* Mobile Symbol Selector Row */}
      <div className="sm:hidden px-4 py-3 border-t border-border/50 bg-background flex justify-center">
        <SymbolSelect value={symbol} onChange={onSymbolChange} />
      </div>
    </header>
  );
}
