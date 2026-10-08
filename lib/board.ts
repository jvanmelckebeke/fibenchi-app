import { boardSpan, type ColorMode } from '@/lib/board-scale';
import type { PulseAsset } from '@/lib/pulse';

// The Board: every asset as a coloured tile, in sections. This is the phone's
// version of the web overview's tile grid, so its rules are the web's: one
// colour scale over the whole book, a symbol shows in every section it belongs
// to, and the Open filter hides tiles without re-scaling the ones left.

export type BoardFilter = 'all' | 'open';

export interface BoardSectionInput {
  title: string;
  symbols: string[];
  accent?: string | null;
}

export interface BoardTile {
  asset: PulseAsset;
  /** The reading in the current mode (σ or today's %), or null. */
  value: number | null;
}

export interface BoardSection {
  title: string;
  /** Thesis colour; null for group sections and "No thesis". */
  accent: string | null;
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

const reading = (asset: PulseAsset, mode: ColorMode) =>
  mode === 'sigma' ? asset.score : asset.changePct;

export function buildBoard(
  assets: PulseAsset[],
  sections: BoardSectionInput[],
  mode: ColorMode,
  filter: BoardFilter
): BoardView {
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

  const readings = assets.map((a) => reading(a, mode)).filter((v): v is number => v !== null);

  const built = sections
    .map((section) => ({
      title: section.title,
      accent: section.accent ?? null,
      tiles: section.symbols
        .map((symbol) => bySymbol.get(symbol))
        .filter((asset): asset is PulseAsset => asset !== undefined)
        .filter((asset) => filter === 'all' || isOpen(asset))
        .map((asset) => ({ asset, value: reading(asset, mode) })),
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
