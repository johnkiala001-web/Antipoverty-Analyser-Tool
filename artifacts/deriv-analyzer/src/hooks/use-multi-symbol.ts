/**
 * useMultiSymbol — streams ticks for multiple Deriv symbols simultaneously
 * over a SINGLE WebSocket connection.
 *
 * On connection open, it sends one ticks_history+subscribe request per symbol.
 * Incoming messages are routed to the correct symbol via echo_req (history)
 * or tick.symbol (live tick). Analysis is computed for each symbol independently.
 */

import { useState, useEffect, useRef } from "react";
import { Tick, AnalysisResult, computeAnalysis } from "@/lib/math";

const WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
const HISTORY_COUNT = 60; // fetch 60 historical ticks per symbol

export type MultiSymbolStatus = "connecting" | "connected" | "disconnected";

export interface SymbolState {
  ticks: Tick[];
  analysis: AnalysisResult | null;
  lastDigit: number | null;
  currentPrice: number | null;
}

type SymbolMap = Record<string, SymbolState>;

function emptySymbolState(): SymbolState {
  return { ticks: [], analysis: null, lastDigit: null, currentPrice: null };
}

export function useMultiSymbol(symbols: string[]) {
  const [status, setStatus]   = useState<MultiSymbolStatus>("disconnected");
  const [data, setData]       = useState<SymbolMap>(() =>
    Object.fromEntries(symbols.map((s) => [s, emptySymbolState()]))
  );

  const wsRef         = useRef<WebSocket | null>(null);
  const retryRef      = useRef<number | null>(null);
  const symbolsRef    = useRef(symbols);
  symbolsRef.current  = symbols;

  useEffect(() => {
    let alive = true;

    function connect() {
      if (!alive) return;
      setStatus("connecting");

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) { ws.close(); return; }
        setStatus("connected");
        // Subscribe to each symbol
        symbolsRef.current.forEach((sym) => {
          ws.send(JSON.stringify({
            ticks_history: sym,
            count: HISTORY_COUNT,
            end: "latest",
            style: "ticks",
            subscribe: 1,
          }));
        });
      };

      ws.onmessage = (event) => {
        if (!alive) return;
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.error) {
            // ignore per-symbol errors (e.g. symbol not available)
            return;
          }

          if (msg.msg_type === "history") {
            const sym    = msg.echo_req?.ticks_history as string;
            if (!sym) return;
            const times  = (msg.history?.times  ?? []) as number[];
            const prices = (msg.history?.prices ?? []) as number[];
            const ticks: Tick[] = times.map((t, i) => ({ epoch: t, quote: prices[i] }));
            const analysis = computeAnalysis(ticks);
            const lastQuote = prices[prices.length - 1];
            const lastDigit = lastQuote != null
              ? parseInt(lastQuote.toFixed(5).slice(-1), 10)
              : null;

            setData((prev) => ({
              ...prev,
              [sym]: {
                ticks,
                analysis,
                lastDigit,
                currentPrice: lastQuote ?? null,
              },
            }));
          } else if (msg.msg_type === "tick") {
            const sym   = msg.tick?.symbol as string;
            const quote = msg.tick?.quote  as number;
            const epoch = msg.tick?.epoch  as number;
            if (!sym || quote == null) return;

            const lastDigit = parseInt(quote.toFixed(5).slice(-1), 10);

            setData((prev) => {
              const prev_state = prev[sym] ?? emptySymbolState();
              const newTick: Tick = { epoch, quote };
              const next = [...prev_state.ticks, newTick];
              const trimmed = next.length > 100 ? next.slice(-100) : next;
              return {
                ...prev,
                [sym]: {
                  ticks: trimmed,
                  analysis: computeAnalysis(trimmed),
                  lastDigit,
                  currentPrice: quote,
                },
              };
            });
          }
        } catch {
          // silently ignore malformed messages
        }
      };

      ws.onerror = () => { ws.close(); };

      ws.onclose = () => {
        if (!alive) return;
        setStatus("disconnected");
        retryRef.current = window.setTimeout(() => {
          if (alive) connect();
        }, 4000);
      };
    }

    connect();

    return () => {
      alive = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []); // Only mount/unmount — symbols are read from ref

  return { status, data };
}
