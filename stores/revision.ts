import { useEffect, useState } from 'react';

/**
 * Calls `fn` at most once per `ms`. A call inside the window schedules one run
 * at its end; further calls in the same window fold into that run. The first
 * call after a quiet spell runs on the next tick, so a lone update isn't held
 * back.
 */
export function throttle(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = -Infinity;
  return {
    call() {
      if (timer !== null) return;
      const wait = Math.max(0, last + ms - Date.now());
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn();
      }, wait);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * The most a screen reading the whole book rebuilds it. Every quote and every
 * daily series that lands would otherwise rebuild all ~90 assets, 178 times on
 * a cold open; a second is still faster than the 20s poll it reports.
 */
export const BOOK_REBUILD_MS = 1_000;

// One revision for everything the book is built from: a quote tick and a daily
// series landing both bump it, and a book reader follows it through one
// throttle, so the two sources together still rebuild at most once per window.
let revision = 0;
const listeners = new Set<() => void>();

/** Something the book is built from changed. */
export function bumpBook(): void {
  revision++;
  listeners.forEach((listener) => listener());
}

/** The book revision, advancing at most once per `BOOK_REBUILD_MS`. */
export function useBookRevision(): number {
  const [current, setCurrent] = useState(revision);
  useEffect(() => {
    const tick = throttle(() => setCurrent(revision), BOOK_REBUILD_MS);
    listeners.add(tick.call);
    tick.call(); // catch up on bumps between render and subscribe
    return () => {
      listeners.delete(tick.call);
      tick.cancel();
    };
  }, []);
  return current;
}
