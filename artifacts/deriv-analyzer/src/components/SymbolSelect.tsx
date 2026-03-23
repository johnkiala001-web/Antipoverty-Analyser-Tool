import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SymbolEntry {
  id: string;
  name: string;
  group: string;
}

const SYMBOLS: SymbolEntry[] = [
  // ── Continuous Volatility (normal tick rate) ──────────────────────────────
  { id: "R_10",  name: "Volatility 10 Index",      group: "Volatility" },
  { id: "R_25",  name: "Volatility 25 Index",      group: "Volatility" },
  { id: "R_50",  name: "Volatility 50 Index",      group: "Volatility" },
  { id: "R_75",  name: "Volatility 75 Index",      group: "Volatility" },
  { id: "R_100", name: "Volatility 100 Index",     group: "Volatility" },

  // ── Volatility (1s) — one tick per second ─────────────────────────────────
  { id: "1HZ10V",  name: "Volatility 10 (1s) Index",  group: "Volatility (1s)" },
  { id: "1HZ25V",  name: "Volatility 25 (1s) Index",  group: "Volatility (1s)" },
  { id: "1HZ50V",  name: "Volatility 50 (1s) Index",  group: "Volatility (1s)" },
  { id: "1HZ75V",  name: "Volatility 75 (1s) Index",  group: "Volatility (1s)" },
  { id: "1HZ100V", name: "Volatility 100 (1s) Index", group: "Volatility (1s)" },

  // ── Crash / Boom ──────────────────────────────────────────────────────────
  { id: "CRASH1000", name: "Crash 1000 Index",  group: "Crash/Boom" },
  { id: "CRASH500",  name: "Crash 500 Index",   group: "Crash/Boom" },
  { id: "BOOM1000",  name: "Boom 1000 Index",   group: "Crash/Boom" },
  { id: "BOOM500",   name: "Boom 500 Index",    group: "Crash/Boom" },

  // ── Other ─────────────────────────────────────────────────────────────────
  { id: "stpRNG", name: "Step Index", group: "Other" },
];

// Build an ordered list of unique groups
const GROUPS = Array.from(new Set(SYMBOLS.map((s) => s.group)));

interface SymbolSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function SymbolSelect({ value, onChange }: SymbolSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = SYMBOLS.find((s) => s.id === value) ?? SYMBOLS[0];
  const filtered = SYMBOLS.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered results
  const groupedFiltered: Record<string, SymbolEntry[]> = {};
  filtered.forEach((s) => {
    if (!groupedFiltered[s.group]) groupedFiltered[s.group] = [];
    groupedFiltered[s.group].push(s);
  });
  const visibleGroups = GROUPS.filter((g) => groupedFiltered[g]?.length);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-72" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5",
          "bg-card border border-border rounded-lg",
          "text-sm font-medium text-foreground hover:bg-card-border/50",
          "transition-all duration-200 shadow-sm outline-none",
          isOpen && "ring-2 ring-primary/30 border-primary/50"
        )}
      >
        <div className="flex flex-col items-start">
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Market
          </span>
          <span className="font-mono text-[13px]">{selected.name}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-border flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
              <input
                type="text"
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>

            {/* Grouped list */}
            <div className="max-h-72 overflow-y-auto p-1 custom-scrollbar">
              {visibleGroups.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No markets found
                </div>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group}>
                    {/* Group header */}
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {group}
                    </div>
                    {groupedFiltered[group].map((symbol) => (
                      <button
                        key={symbol.id}
                        onClick={() => {
                          onChange(symbol.id);
                          setIsOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm",
                          "transition-colors duration-150",
                          value === symbol.id
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-white/5"
                        )}
                      >
                        <span className="font-mono text-[13px]">{symbol.name}</span>
                        <span className="text-[10px] opacity-40 font-mono ml-2">
                          {symbol.id}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
