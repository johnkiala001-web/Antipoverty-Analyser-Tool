"""
Deriv API Real-Time Tick Data Analyzer
=======================================
Connects to the Deriv WebSocket API to stream real-time tick data for
synthetic indices, then computes volatility metrics, last-digit statistics,
and Over/Under probabilities. Outputs a live-updating recommendation table.

Design is modular so AI/ML models can be plugged in later (see `MLPredictor`
stub at the bottom of this file).

Dependencies: websocket-client, pandas, numpy, requests, tabulate, colorama
"""

import os
import sys
import json
import time
import threading
import collections
import math

import numpy as np
import pandas as pd
import websocket
from tabulate import tabulate
from colorama import init, Fore, Style

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089"

# Deriv symbol names for synthetic indices.
# Common choices: R_10, R_25, R_50, R_75, R_100 (Volatility 10/25/50/75/100)
# CRASH/BOOM: CRASH1000, BOOM1000, CRASH500, BOOM500
# Step Index: stpRNG
DEFAULT_SYMBOL = "R_50"          # Volatility 50 Index

# How many historical ticks to keep in the rolling window
TICK_WINDOW = 100

# ATR period (number of ticks used for Average True Range calculation)
ATR_PERIOD = 14

# Refresh rate for the display (seconds)
DISPLAY_REFRESH = 2.0

# Reconnect delay on connection drop (seconds)
RECONNECT_DELAY = 5

# ─────────────────────────────────────────────────────────────────────────────
# DATA STORE — shared state between the WebSocket thread and display thread
# ─────────────────────────────────────────────────────────────────────────────

class TickStore:
    """
    Thread-safe circular buffer that holds the last N ticks.
    New ticks are appended; when the buffer is full the oldest tick is dropped.
    """

    def __init__(self, maxlen: int = TICK_WINDOW):
        self._lock = threading.Lock()
        # Each entry is a dict: {"epoch": int, "quote": float}
        self._ticks: collections.deque = collections.deque(maxlen=maxlen)
        self.symbol = DEFAULT_SYMBOL

    def add(self, epoch: int, quote: float) -> None:
        with self._lock:
            self._ticks.append({"epoch": epoch, "quote": quote})

    def snapshot(self) -> list[dict]:
        """Return a safe copy of all current ticks."""
        with self._lock:
            return list(self._ticks)

    def __len__(self) -> int:
        with self._lock:
            return len(self._ticks)


# Global singleton tick store
store = TickStore()

# ─────────────────────────────────────────────────────────────────────────────
# VOLATILITY MODULE
# ─────────────────────────────────────────────────────────────────────────────

def compute_price_changes(prices: np.ndarray) -> np.ndarray:
    """Return tick-to-tick price differences."""
    if len(prices) < 2:
        return np.array([])
    return np.diff(prices)


def compute_std_dev(prices: np.ndarray) -> float:
    """
    Standard deviation of price changes.
    Measures how much prices fluctuate from tick to tick.
    Higher values → higher volatility.
    """
    changes = compute_price_changes(prices)
    if len(changes) == 0:
        return 0.0
    return float(np.std(changes))


def compute_atr(prices: np.ndarray, period: int = ATR_PERIOD) -> float:
    """
    Average True Range (ATR) adapted for tick data (no OHLC candles).
    Here True Range = |price[i] - price[i-1]| for each consecutive pair.
    ATR = simple moving average of the last `period` true ranges.
    Higher ATR → wider expected price swings.
    """
    if len(prices) < 2:
        return 0.0
    true_ranges = np.abs(np.diff(prices))
    if len(true_ranges) == 0:
        return 0.0
    window = true_ranges[-period:] if len(true_ranges) >= period else true_ranges
    return float(np.mean(window))


def compute_high_low_range(prices: np.ndarray) -> dict:
    """
    Recent high/low range across all ticks in the window.
    Returns high, low, and the spread (high - low).
    """
    if len(prices) == 0:
        return {"high": 0.0, "low": 0.0, "range": 0.0}
    high = float(np.max(prices))
    low  = float(np.min(prices))
    return {"high": high, "low": low, "range": round(high - low, 5)}


def compute_volatility_metrics(ticks: list[dict]) -> dict:
    """
    Aggregate all volatility metrics from the tick list.
    Returns a dict ready for downstream consumption.
    """
    if len(ticks) < 2:
        return {"std_dev": 0.0, "atr": 0.0, "high": 0.0, "low": 0.0, "range": 0.0}

    prices = np.array([t["quote"] for t in ticks])
    hl = compute_high_low_range(prices)

    return {
        "std_dev": compute_std_dev(prices),
        "atr":     compute_atr(prices),
        "high":    hl["high"],
        "low":     hl["low"],
        "range":   hl["range"],
    }

# ─────────────────────────────────────────────────────────────────────────────
# LAST-DIGIT ANALYSIS MODULE
# ─────────────────────────────────────────────────────────────────────────────

def extract_last_digit(quote: float) -> int:
    """
    Extract the last digit from a price quote.
    E.g. 1234.567 → last digit of the decimal portion → 7
    Uses the string representation to avoid floating-point rounding issues.
    """
    s = f"{quote:.5f}"       # e.g. "1234.56789"
    return int(s[-1])        # last character → last decimal digit


def compute_last_digit_stats(ticks: list[dict]) -> dict:
    """
    Analyse the frequency distribution of last digits across all ticks.

    Returns:
        digit_counts   : dict {0..9: count}
        digit_probs    : dict {0..9: probability 0-1}
        even_prob      : probability last digit is even (0,2,4,6,8)
        odd_prob       : probability last digit is odd  (1,3,5,7,9)
        match_probs    : dict {0..9: probability of matching that specific digit}
        differ_prob    : probability last digit differs from the modal digit
    """
    if not ticks:
        empty = {d: 0 for d in range(10)}
        return {
            "digit_counts": empty,
            "digit_probs":  {d: 0.1 for d in range(10)},
            "even_prob":    0.5,
            "odd_prob":     0.5,
            "match_probs":  {d: 0.1 for d in range(10)},
            "differ_prob":  0.9,
        }

    digits = [extract_last_digit(t["quote"]) for t in ticks]
    total  = len(digits)

    # Count occurrences of each digit 0-9
    digit_counts = {d: digits.count(d) for d in range(10)}
    digit_probs  = {d: digit_counts[d] / total for d in range(10)}

    # Even / Odd split
    even_count = sum(digit_counts[d] for d in [0, 2, 4, 6, 8])
    odd_count  = total - even_count
    even_prob  = even_count / total
    odd_prob   = odd_count  / total

    # Matches probability: best digit to "match" is the one appearing most often
    # Differs probability: best digit to "differ" is the one appearing least often
    # We expose per-digit match probabilities so callers can choose
    match_probs = digit_probs  # matching digit d → probability = freq of d

    # Differ probability for the most common digit (i.e. trade that digit ≠ next tick)
    modal_digit = max(digit_counts, key=digit_counts.get)
    differ_prob = 1.0 - digit_probs[modal_digit]

    return {
        "digit_counts": digit_counts,
        "digit_probs":  digit_probs,
        "even_prob":    even_prob,
        "odd_prob":     odd_prob,
        "match_probs":  match_probs,
        "modal_digit":  modal_digit,
        "differ_prob":  differ_prob,
    }

# ─────────────────────────────────────────────────────────────────────────────
# OVER / UNDER ANALYSIS MODULE
# ─────────────────────────────────────────────────────────────────────────────

def compute_over_under_probabilities(ticks: list[dict], volatility: dict) -> dict:
    """
    Determine the probability that the next tick will be OVER or UNDER
    the current price (last tick).

    Methodology:
    1. Count how many of the last N changes were positive (up) vs negative (down).
    2. Weight that directional bias by the price's position within the recent
       high/low range: a price near the top is more likely to reverse downward.
    3. Blend the two signals with equal weight.

    This is a heuristic model — replace or augment with ML later via `MLPredictor`.
    """
    if len(ticks) < 2:
        return {"over_prob": 0.5, "under_prob": 0.5, "recommended": "Neither"}

    prices  = np.array([t["quote"] for t in ticks])
    changes = np.diff(prices)

    # ── Signal 1: momentum (recent directional bias) ─────────────────────────
    up_count   = int(np.sum(changes > 0))
    down_count = int(np.sum(changes < 0))
    total_moves = up_count + down_count

    if total_moves == 0:
        momentum_up = 0.5
    else:
        momentum_up = up_count / total_moves   # fraction of ticks that went up

    # ── Signal 2: mean-reversion pressure ────────────────────────────────────
    # If price is near the top of its range, expect it to come back down.
    price_range = volatility["range"]
    current     = prices[-1]
    low         = volatility["low"]

    if price_range > 0:
        position_in_range = (current - low) / price_range  # 0 = at low, 1 = at high
        # mean-reversion probability of going UP is inversely proportional to position
        mean_rev_up = 1.0 - position_in_range
    else:
        mean_rev_up = 0.5

    # ── Blend signals ─────────────────────────────────────────────────────────
    over_prob  = (0.5 * momentum_up + 0.5 * mean_rev_up)
    under_prob = 1.0 - over_prob

    # Clamp to [0.01, 0.99] to avoid degenerate display
    over_prob  = max(0.01, min(0.99, over_prob))
    under_prob = 1.0 - over_prob

    recommended = "Over" if over_prob >= under_prob else "Under"

    return {
        "over_prob":   over_prob,
        "under_prob":  under_prob,
        "recommended": recommended,
    }

# ─────────────────────────────────────────────────────────────────────────────
# RECOMMENDATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def build_recommendations(ticks: list[dict]) -> list[dict]:
    """
    Run all analysis modules and compile a unified recommendation table.

    Returns a list of row dicts suitable for `tabulate`.
    Each row contains: Contract, Direction, Probability (%), Signal Strength.
    """
    if len(ticks) < 5:
        return []

    vol   = compute_volatility_metrics(ticks)
    digit = compute_last_digit_stats(ticks)
    ou    = compute_over_under_probabilities(ticks, vol)

    rows = []

    # ── Over / Under ──────────────────────────────────────────────────────────
    over_pct  = round(ou["over_prob"]  * 100, 1)
    under_pct = round(ou["under_prob"] * 100, 1)

    rows.append({
        "Contract":   "Over/Under",
        "Direction":  "Over",
        "Probability": f"{over_pct}%",
        "Confidence": _confidence_label(ou["over_prob"]),
        "Recommended": "✓" if ou["recommended"] == "Over" else "",
    })
    rows.append({
        "Contract":   "Over/Under",
        "Direction":  "Under",
        "Probability": f"{under_pct}%",
        "Confidence": _confidence_label(ou["under_prob"]),
        "Recommended": "✓" if ou["recommended"] == "Under" else "",
    })

    # ── Even / Odd ────────────────────────────────────────────────────────────
    even_pct = round(digit["even_prob"] * 100, 1)
    odd_pct  = round(digit["odd_prob"]  * 100, 1)
    eo_rec   = "Even" if digit["even_prob"] >= digit["odd_prob"] else "Odd"

    rows.append({
        "Contract":   "Even/Odd",
        "Direction":  "Even",
        "Probability": f"{even_pct}%",
        "Confidence": _confidence_label(digit["even_prob"]),
        "Recommended": "✓" if eo_rec == "Even" else "",
    })
    rows.append({
        "Contract":   "Even/Odd",
        "Direction":  "Odd",
        "Probability": f"{odd_pct}%",
        "Confidence": _confidence_label(digit["odd_prob"]),
        "Recommended": "✓" if eo_rec == "Odd" else "",
    })

    # ── Matches / Differs ─────────────────────────────────────────────────────
    # Find the digit with the highest probability for "Matches"
    best_digit   = digit["modal_digit"]
    match_prob   = digit["match_probs"][best_digit]
    differ_prob  = digit["differ_prob"]
    match_pct    = round(match_prob  * 100, 1)
    differ_pct   = round(differ_prob * 100, 1)
    md_rec       = "Differs" if differ_prob >= match_prob else f"Match {best_digit}"

    rows.append({
        "Contract":   "Matches/Differs",
        "Direction":  f"Match {best_digit}",
        "Probability": f"{match_pct}%",
        "Confidence": _confidence_label(match_prob),
        "Recommended": "✓" if "Match" in md_rec else "",
    })
    rows.append({
        "Contract":   "Matches/Differs",
        "Direction":  "Differs",
        "Probability": f"{differ_pct}%",
        "Confidence": _confidence_label(differ_prob),
        "Recommended": "✓" if md_rec == "Differs" else "",
    })

    return rows


def _confidence_label(prob: float) -> str:
    """Map a probability to a human-readable confidence label."""
    if prob >= 0.70:
        return "HIGH"
    if prob >= 0.55:
        return "MEDIUM"
    return "LOW"

# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY MODULE
# ─────────────────────────────────────────────────────────────────────────────

init(autoreset=True)   # initialise colorama for cross-platform colour support

CONFIDENCE_COLOR = {
    "HIGH":   Fore.GREEN,
    "MEDIUM": Fore.YELLOW,
    "LOW":    Fore.RED,
}


def clear_screen():
    """Clear terminal on both Linux/macOS and Windows."""
    os.system("cls" if os.name == "nt" else "clear")


def format_recommendation_table(rows: list[dict], vol: dict, digit: dict) -> str:
    """
    Build the full display string:
      - Header with current symbol and tick count
      - Volatility metrics summary
      - Recommendation table with colour coding
    """
    lines = []

    # ── Header ────────────────────────────────────────────────────────────────
    lines.append(Style.BRIGHT + f"  Deriv Tick Analyzer — {store.symbol}  " + Style.RESET_ALL)
    lines.append(f"  Ticks collected: {len(store)}  |  Updated: {time.strftime('%H:%M:%S')}")
    lines.append("")

    # ── Volatility summary ────────────────────────────────────────────────────
    lines.append(Style.BRIGHT + "  Volatility Metrics:" + Style.RESET_ALL)
    lines.append(f"    Std Dev of changes : {vol['std_dev']:.5f}")
    lines.append(f"    ATR ({ATR_PERIOD}-tick)       : {vol['atr']:.5f}")
    lines.append(f"    High               : {vol['high']:.5f}")
    lines.append(f"    Low                : {vol['low']:.5f}")
    lines.append(f"    Range (H-L)        : {vol['range']:.5f}")
    lines.append("")

    # ── Last-digit distribution ───────────────────────────────────────────────
    lines.append(Style.BRIGHT + "  Last-Digit Distribution:" + Style.RESET_ALL)
    dist_line = "    "
    for d in range(10):
        pct = digit["digit_probs"].get(d, 0) * 100
        dist_line += f"{d}:{pct:4.1f}%  "
    lines.append(dist_line)
    lines.append(f"    Modal digit: {digit.get('modal_digit', '?')}")
    lines.append("")

    # ── Recommendation table ──────────────────────────────────────────────────
    if not rows:
        lines.append("  Collecting ticks… need at least 5 ticks to compute recommendations.")
    else:
        lines.append(Style.BRIGHT + "  Recommendations:" + Style.RESET_ALL)

        table_data = []
        for row in rows:
            conf  = row["Confidence"]
            color = CONFIDENCE_COLOR.get(conf, "")
            rec   = row["Recommended"]
            table_data.append([
                row["Contract"],
                row["Direction"],
                row["Probability"],
                color + conf + Style.RESET_ALL,
                rec,
            ])

        headers = ["Contract", "Direction", "Probability", "Confidence", "Rec"]
        lines.append(tabulate(table_data, headers=headers, tablefmt="rounded_outline"))

    lines.append("")
    lines.append(Fore.CYAN + "  Press Ctrl+C to exit." + Style.RESET_ALL)
    return "\n".join(lines)


def display_loop():
    """
    Runs in its own thread. Every DISPLAY_REFRESH seconds it clears the
    terminal and reprints the full recommendation table using the latest ticks.
    """
    while True:
        try:
            ticks = store.snapshot()
            if len(ticks) < 2:
                clear_screen()
                print(f"\n  Waiting for ticks from {store.symbol}…\n")
            else:
                vol   = compute_volatility_metrics(ticks)
                digit = compute_last_digit_stats(ticks)
                rows  = build_recommendations(ticks)

                # Optional: pass rows through ML predictor if available
                rows  = ml_predictor.adjust(rows, ticks)

                clear_screen()
                print(format_recommendation_table(rows, vol, digit))
        except Exception as exc:
            # Never crash the display thread; just show the error and continue
            clear_screen()
            print(f"\n  Display error: {exc}\n")

        time.sleep(DISPLAY_REFRESH)

# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET MODULE — Deriv API connection
# ─────────────────────────────────────────────────────────────────────────────

class DerivWebSocket:
    """
    Manages the WebSocket connection to the Deriv API.
    Subscribes to real-time tick stream for the configured symbol.
    On each incoming tick, the quote is pushed into the global TickStore.
    """

    def __init__(self, symbol: str = DEFAULT_SYMBOL):
        self.symbol = symbol
        self.ws = None
        self._running = True

    def _on_open(self, ws):
        """Called when WebSocket connection is established."""
        print(f"\n  [WS] Connected to Deriv API. Subscribing to {self.symbol} ticks…\n")
        # Send subscription request for tick stream
        subscribe_msg = {
            "ticks": self.symbol,
            "subscribe": 1
        }
        ws.send(json.dumps(subscribe_msg))

    def _on_message(self, ws, message: str):
        """
        Called on every incoming WebSocket message.
        Parses the JSON response and routes tick data to the store.
        """
        try:
            data = json.loads(message)

            # Handle error responses from the API
            if "error" in data:
                error = data["error"]
                print(f"\n  [WS] API error: {error.get('message', error)}\n")
                return

            # Handle tick data
            if data.get("msg_type") == "tick":
                tick = data["tick"]
                epoch = int(tick["epoch"])
                quote = float(tick["quote"])
                store.add(epoch, quote)

        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            # Silently skip malformed messages
            pass

    def _on_error(self, ws, error):
        """Called on WebSocket errors."""
        print(f"\n  [WS] Error: {error}\n")

    def _on_close(self, ws, close_status_code, close_msg):
        """Called when the connection is closed."""
        print(f"\n  [WS] Connection closed (code={close_status_code}, msg={close_msg})\n")

    def run_forever(self):
        """
        Connect and stream ticks.  Automatically reconnects on disconnect.
        This is designed to run in its own thread.
        """
        store.symbol = self.symbol

        while self._running:
            try:
                self.ws = websocket.WebSocketApp(
                    DERIV_WS_URL,
                    on_open    = self._on_open,
                    on_message = self._on_message,
                    on_error   = self._on_error,
                    on_close   = self._on_close,
                )
                # ping_interval keeps the connection alive
                self.ws.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as exc:
                print(f"\n  [WS] Exception in run_forever: {exc}\n")

            if self._running:
                print(f"  [WS] Reconnecting in {RECONNECT_DELAY}s…\n")
                time.sleep(RECONNECT_DELAY)

    def stop(self):
        """Gracefully close the WebSocket connection."""
        self._running = False
        if self.ws:
            self.ws.close()

# ─────────────────────────────────────────────────────────────────────────────
# HISTORICAL TICK FETCH (REST API)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_historical_ticks(symbol: str = DEFAULT_SYMBOL, count: int = TICK_WINDOW) -> int:
    """
    Fetches the last `count` historical ticks via the Deriv REST-like WebSocket
    request (ticks_history endpoint) and pre-populates the global TickStore.

    Returns the number of ticks loaded.

    Note: Deriv does not have a traditional REST endpoint — all API calls go
    through the WebSocket. This function uses a one-shot synchronous call
    pattern to bootstrap historical data before the live stream starts.
    """
    loaded = 0
    result_event = threading.Event()
    ticks_data: list[dict] = []

    def on_open(ws):
        req = {
            "ticks_history": symbol,
            "count": count,
            "end": "latest",
            "style": "ticks",
        }
        ws.send(json.dumps(req))

    def on_message(ws, message):
        nonlocal loaded
        try:
            data = json.loads(message)
            if "error" in data:
                print(f"  [History] API error: {data['error'].get('message')}")
                result_event.set()
                ws.close()
                return
            if data.get("msg_type") == "history":
                hist = data["history"]
                prices = hist.get("prices", [])
                times  = hist.get("times",  [])
                for epoch, price in zip(times, prices):
                    store.add(int(epoch), float(price))
                    loaded += 1
                result_event.set()
                ws.close()
        except Exception:
            result_event.set()
            ws.close()

    def on_error(ws, err):
        print(f"  [History] WS error: {err}")
        result_event.set()

    def on_close(ws, *args):
        result_event.set()

    ws_hist = websocket.WebSocketApp(
        DERIV_WS_URL,
        on_open    = on_open,
        on_message = on_message,
        on_error   = on_error,
        on_close   = on_close,
    )

    thread = threading.Thread(target=ws_hist.run_forever, daemon=True)
    thread.start()
    result_event.wait(timeout=15)   # wait up to 15 seconds for history

    return loaded

# ─────────────────────────────────────────────────────────────────────────────
# ML PREDICTOR STUB
# ─────────────────────────────────────────────────────────────────────────────

class MLPredictor:
    """
    Placeholder for a future AI/ML prediction model.

    To integrate a real model:
    1. Train or load a model in __init__ (e.g. scikit-learn, PyTorch, etc.)
    2. In `adjust()`, extract features from `ticks`, run inference, and
       update the probability scores in `rows` accordingly.
    3. The rest of the pipeline requires no changes.

    Example feature engineering ideas:
    - Lagged price returns
    - Rolling mean and std dev
    - Autocorrelation of returns
    - RSI, MACD computed from tick prices
    - Time-of-day features
    """

    def __init__(self):
        self.model = None           # Replace with: load model from disk, etc.
        self.is_trained = False

    def train(self, ticks: list[dict]) -> None:
        """
        Train or fine-tune the model on the latest ticks.
        Call periodically as more data accumulates.
        """
        # TODO: build feature matrix from ticks, fit self.model
        pass

    def predict(self, ticks: list[dict]) -> dict:
        """
        Run inference and return probability overrides per contract type.
        Return an empty dict if no prediction is available.
        """
        # TODO: return {contract_key: adjusted_probability, ...}
        return {}

    def adjust(self, rows: list[dict], ticks: list[dict]) -> list[dict]:
        """
        Given the heuristic recommendation rows, optionally override or blend
        ML-predicted probabilities.  Returns modified (or unchanged) rows.
        """
        if not self.is_trained:
            return rows   # pass through unchanged until model is ready

        predictions = self.predict(ticks)
        # TODO: merge predictions into rows
        return rows


# Instantiate a global predictor (no-op until a real model is loaded)
ml_predictor = MLPredictor()

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    # Allow overriding the symbol via command-line argument
    symbol = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SYMBOL
    store.symbol = symbol

    print(f"\n  Deriv Tick Analyzer starting…")
    print(f"  Symbol : {symbol}")
    print(f"  Window : {TICK_WINDOW} ticks")
    print(f"  Fetching {TICK_WINDOW} historical ticks to seed the analysis…")

    # Pre-load historical data so recommendations appear immediately
    loaded = fetch_historical_ticks(symbol, count=TICK_WINDOW)
    print(f"  Loaded {loaded} historical ticks.")

    # Start the live WebSocket stream in a background thread
    deriv_ws = DerivWebSocket(symbol=symbol)
    ws_thread = threading.Thread(target=deriv_ws.run_forever, daemon=True)
    ws_thread.start()

    # Start the display refresh loop in a background thread
    display_thread = threading.Thread(target=display_loop, daemon=True)
    display_thread.start()

    # Main thread just waits for Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n  Shutting down…")
        deriv_ws.stop()
        sys.exit(0)


if __name__ == "__main__":
    main()
