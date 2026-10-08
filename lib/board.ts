import { boardSpan, type ColorMode } from '@/lib/board-scale';
import type { OhlcBar } from '@/lib/market';
import { windowReturns, type WindowReturns } from '@/lib/movers';
import type { PulseAsset } from '@/lib/pulse';

// The Board: every asset as a coloured tile, in sections. This is the phone's
// version of the web overview's tile grid, so its rules are the web's: one
// colour scale over the whole book, a symbol shows in every section it belongs
// to, and the Open filter hides tiles without re-scaling the ones left. Within
// a section, tiles rank by the reading on show.

export type BoardFilter = 'all' | 'open';

export interface BoardSectionInput {
  title: string;
  symbols: string[];
}

export interface BoardTile {
  asset: PulseAsset;
  /** The reading in the current mode (σ or today's %), or null. */
  value: number | null;
  /** % over 1wk / 2wk / 1mo, as the web tile's bar strip. */
  windows: WindowReturns;
}

export interface BoardSection {
  title: string;
  tiles: BoardTile[];
}

export interface BoardCoverage {
  /** Assets on a venue in its regular session right now. */
  open: number;
  scored: number;
  /** Daily bars still loading, so σ will fill in. */
  pending: number;
  total: number;
}

export interface BoardView {
  sections: BoardSection[];
  /** The ramp's ±span for this mode, shared by every tile. */
  span: number;
  coverage: BoardCoverage;
}

/** Regular session only, as on the web board: pre and post count as not open. */
export const isOpen = (asset: PulseAsset) => asset.quote?.marketState === 'regular';

/**
 * Strongest up first, strongest down last, in whichever reading the mode shows,
 * so a section reads as a ranking. Tiles with no reading go to the end.
 */
function byReading(a: BoardTile, b: BoardTile): number {
  if (a.value === null || b.value === null) {
    if (a.value !== b.value) return a.value === null ? 1 : -1;
  } else if (a.value !== b.value) {
    return b.value - a.value;
  }
  return a.asset.symbol.localeCompare(b.asset.symbol);
}

const reading = (asset: PulseAsset, mode: ColorMode) =>
  mode === 'sigma' ? asset.score : asset.changePct;

export function buildBoard(
  assets: PulseAsset[],
  sections: BoardSectionInput[],
  mode: ColorMode,
  filter: BoardFilter,
  daily: Record<string, OhlcBar[] | undefined>,
  now: number
): BoardView {
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

  const readings = assets.map((a) => reading(a, mode)).filter((v): v is number => v !== null);

  const built = sections
    .map((section) => ({
      title: section.title,
      tiles: section.symbols
        .map((symbol) => bySymbol.get(symbol))
        .filter((asset): asset is PulseAsset => asset !== undefined)
        .filter((asset) => filter === 'all' || isOpen(asset))
        .map((asset) => ({
          asset,
          value: reading(asset, mode),
          windows: windowReturns(daily[asset.symbol], asset.quote?.price ?? null, now),
        }))
        .sort(byReading),
    }))
    .filter((section) => section.tiles.length > 0);

  return {
    sections: built,
    span: boardSpan(readings, assets.length, mode),
    coverage: {
      open: assets.filter(isOpen).length,
      scored: assets.filter((a) => a.score !== null).length,
      pending: assets.filter((a) => a.sigma === null && a.unscored === null).length,
      total: assets.length,
    },
  };
}
