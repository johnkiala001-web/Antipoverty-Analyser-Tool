import { useState, useEffect, useRef, useCallback } from "react";
import { Tick, AnalysisResult, computeAnalysis } from "@/lib/math";

const WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useDerivWebSocket(symbol: string) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      // Ask for 100 historical ticks, which will automatically stream live ticks afterwards because we add subscribe: 1
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          count: 100,
          end: "latest",
          style: "ticks",
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.msg_type === "history") {
          const times = data.history.times as number[];
          const prices = data.history.prices as number[];
          const initialTicks = times.map((t, i) => ({
            epoch: t,
            quote: prices[i],
          }));
          setTicks(initialTicks);
          setAnalysis(computeAnalysis(initialTicks));
        } else if (data.msg_type === "tick") {
          const tick = { epoch: data.tick.epoch, quote: data.tick.quote };
          setTicks((prev) => {
            const next = [...prev, tick];
            const trimmed = next.length > 100 ? next.slice(-100) : next;
            // Update analysis on every tick
            setAnalysis(computeAnalysis(trimmed));
            return trimmed;
          });
        } else if (data.error) {
          console.error("Deriv API Error:", data.error.message);
        }
      } catch (err) {
        // Silently ignore parse errors
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      // Reconnect logic
      reconnectTimeoutRef.current = window.setTimeout(() => {
        setReconnectCount((c) => c + 1);
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      // ws.onclose will handle the actual reconnection
      ws.close();
    };
  }, [symbol]);

  useEffect(() => {
    // Clear ticks immediately on symbol change
    setTicks([]);
    setAnalysis(null);
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    ticks,
    analysis,
    reconnectCount,
  };
}
