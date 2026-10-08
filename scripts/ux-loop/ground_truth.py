"""Snapshot what fibenchi's web overview knows right now, as the grader's reference.

    python3 scripts/ux-loop/ground_truth.py --out <dir>/truth.json

Run it within a minute of capture.py so both describe the same moment. Writes
the raw API responses plus one derived row per symbol: price, day change %,
σ-Move resolved the way fibenchi's `sigma.ts` resolves it, RSI, venue phase,
and the 1wk/2wk/1mo moves from daily closes.
"""

import argparse
import json
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from env import fibenchi_endpoint

VNR_MAX_SESSIONS_BEHIND = 3  # mirrors fibenchi's generated backend constant


def get(base: str, path: str, **params) -> Any:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    with urllib.request.urlopen(f"{base}/api{path}{query}", timeout=60) as r:
        return json.load(r)


def resolve_sigma(quote: dict | None, snap: dict | None) -> tuple[float | None, str]:
    """Simplified sigma.ts: settled when the bar is the quote's session, else live from change %."""
    if not snap:
        return None, "no_data"
    v = snap.get("values") or {}
    stored, forecast, gap = v.get("vnr"), v.get("vnr_sigma"), v.get("vnr_gap_sessions")
    sessions = (quote or {}).get("recent_sessions") or []
    behind = sessions.index(snap["as_of"]) if snap.get("as_of") in sessions else None
    change = (quote or {}).get("change_percent")
    live = behind is not None and (behind >= 1 or gap is not None) and behind <= VNR_MAX_SESSIONS_BEHIND
    if live and change is not None and forecast:
        return round(change / 100 / forecast, 2), "live"
    if stored is not None and (behind is None or behind == 0):
        return round(stored, 2), "settled"
    return None, "withheld"


def window_moves(prices: list[dict], quote: dict | None) -> dict[str, float | None]:
    """% move to the live price from the last close at least 7/14/30 days before it.

    fibenchi stores no bar for a session still trading, so the quote stands in
    for today's close; without it the windows would end yesterday.
    """
    closes = [(date.fromisoformat(p["date"][:10]), p["close"]) for p in prices if p.get("close") is not None]
    if quote and quote.get("price") is not None and quote.get("session_date"):
        today = date.fromisoformat(quote["session_date"])
        closes = [c for c in closes if c[0] < today] + [(today, quote["price"])]
    if not closes:
        return {}
    last_day, last = closes[-1]
    out = {}
    for label, days in (("1wk", 7), ("2wk", 14), ("1mo", 30)):
        cutoff = last_day - timedelta(days=days)
        base = next((c for d, c in reversed(closes) if d <= cutoff), None)
        out[label] = round((last / base - 1) * 100, 2) if base else None
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Snapshot fibenchi's overview data for grading")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    base = fibenchi_endpoint()
    taken = datetime.now(timezone.utc).isoformat()

    config = get(base, "/companion/config")
    symbols = list(config["tickers"])
    groups = get(base, "/groups")
    quotes = {q["symbol"]: q for q in get(base, "/quotes", symbols=",".join(symbols))}
    with ThreadPoolExecutor(8) as pool:
        indicators = {}
        for chunk in pool.map(lambda g: get(base, f"/groups/{g['id']}/indicators"), groups):
            indicators.update(chunk)
        since = (date.today() - timedelta(days=45)).isoformat()
        prices = dict(zip(symbols, pool.map(lambda s: _prices(base, s, since), symbols)))
    phases = get(base, "/market/phases")
    venue_of = {s: v for v, p in phases.items() for s in p.get("symbols", [])}

    rows = []
    for s in symbols:
        q, snap = quotes.get(s), indicators.get(s)
        sigma, source = resolve_sigma(q, snap)
        venue = venue_of.get(s)
        rows.append({
            "symbol": s,
            "name": config["tickers"][s]["name"].strip(),
            "groups": [g["name"] for g in config["groups"] if s in g["symbols"]],
            "price": (q or {}).get("price"),
            "currency": (q or {}).get("currency"),
            "change_pct": (q or {}).get("change_percent"),
            "session_date": (q or {}).get("session_date"),
            "market_state": (q or {}).get("market_state"),
            "venue": venue,
            "venue_phase": phases.get(venue, {}).get("phase") if venue else None,
            "sigma": sigma,
            "sigma_source": source,
            "rsi": ((snap or {}).get("values") or {}).get("rsi"),
            "rvol": ((snap or {}).get("values") or {}).get("rvol"),
            **window_moves(prices.get(s) or [], q),
        })

    truth = {
        "taken_at": taken,
        "rows": sorted(rows, key=lambda r: -abs(r["sigma"] or 0)),
        "portfolio_index": {k: v for k, v in get(base, "/portfolio/index").items() if k not in ("dates", "values")},
        "performers": get(base, "/portfolio/performers"),
        "phases": {v: {"phase": p["phase"], "next_change_at": p.get("next_change_at")} for v, p in phases.items()},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(truth, indent=1))
    scored = [r for r in rows if r["sigma"] is not None]
    print(f"{len(rows)} symbols, {len(scored)} with σ, at {taken} -> {args.out}")


def _prices(base: str, symbol: str, since: str) -> list[dict]:
    try:
        data = get(base, f"/assets/{urllib.parse.quote(symbol, safe='')}/prices", period="3mo")
    except Exception:
        return []
    return [p for p in data if isinstance(p, dict) and str(p.get("date", "")) >= since] if isinstance(data, list) else []


if __name__ == "__main__":
    main()
