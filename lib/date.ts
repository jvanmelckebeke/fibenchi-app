const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_MS = 86_400_000;
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Label a trading session by the local calendar day its data falls on, relative
 * to `now`. The intraday series may not be from "today": on a weekend it's
 * Friday's session, and before the market opens it's the prior session. Uses
 * plain arrays (no `Intl`, which is unreliable on Hermes).
 */
export function sessionLabel(epochSeconds: number, now: Date = new Date()): string {
  const d = new Date(epochSeconds * 1000);
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / DAY_MS);
  if (diffDays <= 0) return 'Today';
  // Weekday name (not "Yesterday") for any prior session within the week — so a
  // Tuesday-morning view of Monday's session reads "Monday".
  if (diffDays < 7) return WEEKDAYS[d.getDay()];
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
