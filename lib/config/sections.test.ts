import type { CompanionConfig } from '@jvanmelckebeke/fibenchi-contract';

import { bookSymbols, groupSections, thesisSections, trackedSymbols } from './index';

const config: CompanionConfig = {
  version: 1,
  generatedAt: '2026-10-08T18:00:00Z',
  groups: [
    { name: 'Hotlist', icon: null, isDefault: false, position: 1, symbols: ['NVDA', 'ASML'] },
    { name: 'Watchlist', icon: null, isDefault: true, position: 9, symbols: ['ASML', 'IBM'] },
  ],
  theses: [
    { name: 'AI capex', color: '#7c3aed', symbols: ['NVDA', 'SMCI'] },
    { name: 'Lithography', color: null, symbols: ['ASML', 'NVDA'] },
  ],
};

describe('symbol sets', () => {
  it('keeps the book to grouped symbols and adds thesis-only ones to the tracked set', () => {
    expect(bookSymbols(config)).toEqual(['ASML', 'IBM', 'NVDA']);
    expect(trackedSymbols(config)).toEqual(['ASML', 'IBM', 'NVDA', 'SMCI']);
  });

  it('tracks only the book when the server sends no theses', () => {
    const { theses, ...older } = config;
    expect(trackedSymbols(older)).toEqual(bookSymbols(older));
  });
});

describe('sections', () => {
  it('orders group sections with the default group first', () => {
    expect(groupSections(config).map((s) => s.title)).toEqual(['Watchlist', 'Hotlist']);
  });

  it("lists theses in the bundle's order, then the book's leftovers as No thesis", () => {
    expect(thesisSections(config)).toEqual([
      { title: 'AI capex', symbols: ['NVDA', 'SMCI'], accent: '#7c3aed' },
      { title: 'Lithography', symbols: ['ASML', 'NVDA'], accent: null },
      { title: 'No thesis', symbols: ['IBM'] },
    ]);
  });

  it('drops the No thesis section when every symbol has one', () => {
    const covered = { ...config, groups: [config.groups![0]] };
    expect(thesisSections(covered).map((s) => s.title)).toEqual(['AI capex', 'Lithography']);
  });
});
