import type { NoteWindowData, TabPageData } from '../types/app';

export const DEFAULT_TAB_NAMES = [
  'Parameter',
  'Features',
  'Physical Pins',
  'Communication',
  'Firebase Path',
];

export const DEFAULT_WINDOWS = 7;
export const MIN_WIN_HEIGHT = 110;
export const DEFAULT_WIN_HEIGHT = 210;
export const DEFAULT_WIN_WIDTH = 340;
export const DEFAULT_FONT_SIZE = 11;

export function createEmptyWindow(idPrefix: string, index: number): NoteWindowData {
  return {
    id: `${idPrefix}_w_${index}_${Math.random().toString(36).slice(2, 7)}`,
    content: '',
    meta: {
      font_size: DEFAULT_FONT_SIZE,
      font_color: '#1a1a2e',
      bold: false,
      italic: false,
      height: DEFAULT_WIN_HEIGHT,
      win_width: DEFAULT_WIN_WIDTH,
      wrap: 'word',
    },
  };
}

export function createDefaultTab(name: string, index: number): TabPageData {
  const idPrefix = `tab_${index}_${Date.now()}`;
  return {
    id: idPrefix,
    tab_name: name,
    orient: 'vertical',
    focused_index: 0,
    windows: Array.from({ length: DEFAULT_WINDOWS }, (_, wIdx) =>
      createEmptyWindow(idPrefix, wIdx)
    ),
  };
}

export function createDefaultTabs(): TabPageData[] {
  return DEFAULT_TAB_NAMES.map((name, idx) => createDefaultTab(name, idx));
}
