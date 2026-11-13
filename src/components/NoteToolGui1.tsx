import React, { useEffect, useRef, useState } from 'react';
import { OverlayLayer, TextHelpModal } from './HelpAndOverlay';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_WIN_HEIGHT,
  DEFAULT_WIN_WIDTH,
  MIN_WIN_HEIGHT,
} from '../utils/noteConstants';
import {
  formatAllWindowsOriginalForm,
  formatWindowOriginalForm,
  noteSlug,
  tabToText,
} from '../utils/generators';
import { DEFAULT_GUI1_HELP_TXT, type OverlayMap } from '../utils/helpContent';
import type { NoteToolProject, NoteWindowData, TabPageData, WrapMode } from '../types/app';

interface NoteToolGui1Props {
  projectName: string;
  saveDir: string;
  tabs: TabPageData[];
  activeTabIdx: number;
  statusMessage: string;
  hasUnsavedChanges: boolean;
  lastAutoSaveTime: string | null;
  autoSavePulse: boolean;
  overlayMode: boolean;
  overlaysMap: OverlayMap;
  onEditOverlay: (id: string) => void;
  onSelectTab: (idx: number) => void;
  onAddTab: (name: string) => void;
  onCloseTab: (idx: number) => void;
  onRenameTab: (idx: number, newName: string) => void;
  onToggleOrient: (tabIdx: number) => void;
  onAddWindow: (tabIdx: number, content?: string, meta?: NoteWindowData['meta']) => void;
  onFocusWindow: (tabIdx: number, winIdx: number) => void;
  onUpdateWindowContent: (tabIdx: number, winIdx: number, content: string) => void;
  onUpdateWindowMeta: (
    tabIdx: number,
    winIdx: number,
    patch: Partial<NoteWindowData['meta']>
  ) => void;
  onClearTab: (tabIdx: number) => void;
  onNewProject: (name: string, dir: string) => void;
  onLoadProject: (project: NoteToolProject) => void;
  onSetSaveDir: (dir: string) => void;
  onSaveProject: (dir: string, name: string, alsoDownload: boolean) => Promise<void>;
  onSaveAll: (dir: string, baseName: string, alsoDownloadCombined: boolean) => Promise<void>;
  onLaunchGenerator: () => void;
  onStatus: (msg: string) => void;
}

const FONT_COLORS = [
  '#1a1a2e',
  '#1a4fb5',
  '#0f766e',
  '#15803d',
  '#7c3aed',
  '#b45309',
  '#dc2626',
  '#475569',
];

export const NoteToolGui1: React.FC<NoteToolGui1Props> = ({
  projectName,
  saveDir,
  tabs,
  activeTabIdx,
  statusMessage,
  hasUnsavedChanges,
  lastAutoSaveTime,
  autoSavePulse,
  overlayMode,
  overlaysMap,
  onEditOverlay,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onToggleOrient,
  onAddWindow,
  onFocusWindow,
  onUpdateWindowContent,
  onUpdateWindowMeta,
  onClearTab,
  onNewProject,
  onLoadProject,
  onSetSaveDir,
  onSaveProject,
  onSaveAll,
  onLaunchGenerator,
  onStatus,
}) => {
  const activeTab = tabs[activeTabIdx] ?? tabs[0];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const windowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Modals & Popovers
  const [dialog, setDialog] = useState<
    | null
    | { type: 'new_project'; name: string; dir: string }
    | { type: 'set_dir'; dir: string }
    | { type: 'add_tab'; name: string }
    | { type: 'rename_tab'; idx: number; name: string }
    | { type: 'close_tab'; idx: number; name: string }
    | { type: 'clear_tab'; idx: number; name: string }
    | { type: 'clear_window'; winIdx: number }
    | { type: 'save_project'; dir: string; name: string; error?: string }
    | { type: 'save_all_txt'; dir: string; name: string; error?: string }
    | { type: 'warning'; title: string; message: string }
  >(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);

  const [colorPickerWin, setColorPickerWin] = useState<number | null>(null);
  const [originalFormModal, setOriginalFormModal] = useState<{
    activeTab: 'all' | number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    winIdx: number;
    x: number;
    y: number;
  } | null>(null);
  const [inlineOriginalByWin, setInlineOriginalByWin] = useState<
    Record<string, boolean>
  >({});
  const [copiedBlinkBtn, setCopiedBlinkBtn] = useState<'current' | 'all' | null>(
    null
  );
  const copyBlinkTimeoutRef = useRef<number | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const triggerCopyBlink = (btn: 'current' | 'all') => {
    setCopiedBlinkBtn(null);
    window.requestAnimationFrame(() => {
      setCopiedBlinkBtn(btn);
    });
    if (copyBlinkTimeoutRef.current !== null) {
      window.clearTimeout(copyBlinkTimeoutRef.current);
    }
    copyBlinkTimeoutRef.current = window.setTimeout(() => {
      setCopiedBlinkBtn(null);
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (copyBlinkTimeoutRef.current !== null) {
        window.clearTimeout(copyBlinkTimeoutRef.current);
      }
    };
  }, []);

  // Drag resizing state
  const dragRef = useRef<{
    winIdx: number;
    orient: 'vertical' | 'horizontal';
    startCoord: number;
    startSize: number;
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.orient === 'vertical') {
        const nextH = Math.max(MIN_WIN_HEIGHT, d.startSize + (e.clientY - d.startCoord));
        onUpdateWindowMeta(activeTabIdx, d.winIdx, { height: Math.round(nextH) });
      } else {
        const nextW = Math.max(220, d.startSize + (e.clientX - d.startCoord));
        onUpdateWindowMeta(activeTabIdx, d.winIdx, { win_width: Math.round(nextW) });
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeTabIdx, onUpdateWindowMeta]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(null);
      setColorPickerWin(null);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const openSaveProjectDialog = () => {
    setDialog({
      type: 'save_project',
      dir: saveDir || 'workspace',
      name: projectName || 'NoteTool_Project',
    });
  };

  const openSaveAllDialog = () => {
    setDialog({
      type: 'save_all_txt',
      dir: saveDir || 'workspace',
      name: projectName || 'note_tool',
    });
  };

  // Keyboard shortcuts matching note_tool.py + Esc to close popups/modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dialog && !isSaving) {
          e.preventDefault();
          setDialog(null);
        } else if (originalFormModal) {
          e.preventDefault();
          setOriginalFormModal(null);
        } else if (contextMenu || colorPickerWin !== null) {
          e.preventDefault();
          setContextMenu(null);
          setColorPickerWin(null);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSaveProjectDialog();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setDialog({ type: 'new_project', name: 'my_project', dir: saveDir });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const scrollToWindow = (winIdx: number) => {
    if (!activeTab) return;
    const win = activeTab.windows[winIdx];
    if (!win) return;
    onFocusWindow(activeTabIdx, winIdx);
    const cardEl = windowRefs.current[win.id];
    const taEl = textareaRefs.current[win.id];
    cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    taEl?.focus();
  };

  const handleLoadProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as Record<string, unknown>;
      const rawTabs = raw.tabs;
      let parsedTabsList: Array<Record<string, unknown>> = [];
      if (Array.isArray(rawTabs)) {
        parsedTabsList = rawTabs as Array<Record<string, unknown>>;
      } else if (rawTabs && typeof rawTabs === 'object') {
        const obj = rawTabs as Record<string, Record<string, unknown>>;
        parsedTabsList = Object.keys(obj)
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => obj[k]);
      }

      const normalizedTabs: TabPageData[] = parsedTabsList.map((td, idx) => {
        const rawWins = Array.isArray(td.windows) ? td.windows : [];
        const windows: NoteWindowData[] = rawWins.map((w: Record<string, unknown>, wIdx: number) => {
          const m = (w.meta as Partial<NoteWindowData['meta']>) || {};
          return {
            id: `tab_${idx}_win_${wIdx}_${Date.now()}`,
            content: String(w.content ?? ''),
            meta: {
              font_size: Number(m.font_size ?? DEFAULT_FONT_SIZE),
              font_color: String(m.font_color ?? '#1a1a2e'),
              bold: Boolean(m.bold),
              italic: Boolean(m.italic),
              height: Number(m.height ?? DEFAULT_WIN_HEIGHT),
              win_width: Number(m.win_width ?? DEFAULT_WIN_WIDTH),
              wrap: (m.wrap as WrapMode) || 'word',
            },
          };
        });
        return {
          id: `tab_${idx}_${Date.now()}`,
          tab_name: String(td.tab_name ?? `Tab ${idx + 1}`),
          orient: td.orient === 'horizontal' ? 'horizontal' : 'vertical',
          windows,
          focused_index: 0,
        };
      });

      const projName =
        typeof raw.project_name === 'string' && raw.project_name.trim()
          ? raw.project_name
          : file.name.replace(/\.(notetool|json)$/i, '');

      onLoadProject({
        version: 3,
        saved: String(raw.saved ?? new Date().toISOString()),
        project_name: projName,
        save_dir: String(raw.save_dir ?? saveDir),
        tabs: normalizedTabs,
      });
    } catch (err) {
      setDialog({
        type: 'warning',
        title: 'Load Error',
        message: `Failed to parse project file: ${String(err)}`,
      });
    }
  };

  const downloadSingleTxt = (page: TabPageData) => {
    const content = tabToText(page);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${noteSlug(page.tab_name)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const insertIntoWindow = (winIdx: number, snippet: string) => {
    if (!activeTab) return;
    const win = activeTab.windows[winIdx];
    if (!win) return;
    const ta = textareaRefs.current[win.id];
    if (ta) {
      const start = ta.selectionStart ?? win.content.length;
      const end = ta.selectionEnd ?? win.content.length;
      const next = win.content.slice(0, start) + snippet + win.content.slice(end);
      onUpdateWindowContent(activeTabIdx, winIdx, next);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    } else {
      onUpdateWindowContent(activeTabIdx, winIdx, win.content + snippet);
    }
  };

  if (!activeTab) return null;

  const focusedIdx = Math.max(
    0,
    Math.min(activeTab.focused_index, activeTab.windows.length - 1)
  );

  return (
    <div
      className="flex flex-col h-full w-full select-none"
      style={{ backgroundColor: '#f5f5f5', fontFamily: "'Courier New', Courier, monospace" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".notetool,.json"
        className="hidden"
        onChange={handleLoadProjectFile}
      />

      {/* ── MENU BAR (#ffffff) ── */}
      <div
        className="relative flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b"
        style={{ backgroundColor: '#ffffff', borderColor: '#bec8de' }}
      >
        <OverlayLayer
          id="gui1_menubar"
          enabled={overlayMode}
          item={overlaysMap.gui1_menubar}
          fallbackTitle="GUI1 Menu Bar"
          onEdit={onEditOverlay}
        />
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-bold tracking-tight" style={{ color: '#1a4fb5' }}>
            📝 NOTE TOOL
          </span>
          <span
            className="text-xs italic truncate max-w-[260px]"
            style={{ color: projectName ? '#1a4fb5' : '#8899aa' }}
            title={`${projectName}.notetool (${saveDir})`}
          >
            {projectName
              ? `📄 ${projectName}.notetool${hasUnsavedChanges ? ' *' : ''} (${saveDir})`
              : 'No project loaded'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDialog({ type: 'set_dir', dir: saveDir })}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#7c3aed' }}
          >
            📁 Default Dir
          </button>
          <button
            type="button"
            onClick={() =>
              setDialog({ type: 'new_project', name: 'my_project', dir: saveDir })
            }
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#6d28d9' }}
          >
            🆕 New Project
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#0369a1' }}
          >
            📂 Load Project
          </button>
          <button
            type="button"
            onClick={openSaveProjectDialog}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#0f766e' }}
          >
            💾 Save Project
          </button>
          <button
            type="button"
            onClick={openSaveAllDialog}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#15803d' }}
          >
            💾 Save All
          </button>
          <button
            type="button"
            onClick={() =>
              setDialog({
                type: 'clear_tab',
                idx: activeTabIdx,
                name: activeTab.tab_name,
              })
            }
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#dc2626' }}
          >
            🗑 Clear Tab
          </button>
          <button
            type="button"
            onClick={onLaunchGenerator}
            className="px-3 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-95 shadow-sm transition-opacity"
            style={{ backgroundColor: '#2563eb' }}
          >
            ⚡ Generate Data
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="px-2.5 py-1 text-xs font-bold cursor-pointer hover:bg-slate-200 border"
            style={{
              backgroundColor: '#f1f5f9',
              borderColor: '#bec8de',
              color: '#1a4fb5',
            }}
            title="Help — Explain GUI1 and all buttons"
          >
            ❓ Help
          </button>
        </div>
      </div>

      {/* ── DYNAMIC TAB BAR (#e4e8f0) ── */}
      <div
        className="relative flex items-center justify-between px-2 py-1 border-b-2"
        style={{ backgroundColor: '#e4e8f0', borderColor: '#bec8de' }}
      >
        <OverlayLayer
          id="gui1_tabbar"
          enabled={overlayMode}
          item={overlaysMap.gui1_tabbar}
          fallbackTitle="GUI1 Dynamic Tab Bar"
          onEdit={onEditOverlay}
        />
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {tabs.map((tab, idx) => {
            const isActive = idx === activeTabIdx;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(idx)}
                onDoubleClick={() =>
                  setDialog({ type: 'rename_tab', idx, name: tab.tab_name })
                }
                title="Click to switch, double-click to rename"
                className="flex items-center border cursor-pointer shrink-0 transition-colors"
                style={{
                  backgroundColor: isActive ? '#ffffff' : '#d8dce8',
                  borderColor: isActive ? '#1a4fb5' : '#bec8de',
                }}
              >
                <span
                  className="px-2.5 py-1 text-xs"
                  style={{
                    color: isActive ? '#1a4fb5' : '#8899aa',
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {tab.tab_name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tabs.length <= 1) {
                      setDialog({
                        type: 'warning',
                        title: 'Cannot Close',
                        message: 'At least one tab must remain.',
                      });
                    } else {
                      setDialog({ type: 'close_tab', idx, name: tab.tab_name });
                    }
                  }}
                  className="px-1.5 py-1 text-xs font-bold cursor-pointer hover:opacity-80"
                  style={{ color: isActive ? '#dc2626' : '#8899aa' }}
                  title="Close tab"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setDialog({ type: 'add_tab', name: 'New Tab' })}
          className="ml-2 px-2.5 py-0.5 text-sm font-bold text-white cursor-pointer shrink-0 hover:opacity-90"
          style={{ backgroundColor: '#22c55e' }}
          title="Add New Tab"
        >
          ＋
        </button>
      </div>

      {/* ── TAB TOOLBAR (#f7f8fc) ── */}
      <div
        className="relative flex items-center justify-between px-3 py-1.5 border-b"
        style={{ backgroundColor: '#f7f8fc', borderColor: '#bec8de' }}
      >
        <OverlayLayer
          id="gui1_toolbar"
          enabled={overlayMode}
          item={overlaysMap.gui1_toolbar}
          fallbackTitle="GUI1 Tab Toolbar"
          onEdit={onEditOverlay}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: '#1a4fb5' }}>
            {activeTab.tab_name}
          </span>
          <span className="text-xs" style={{ color: '#8899aa' }}>
            ({activeTab.windows.length} windows)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAddWindow(activeTabIdx)}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90"
            style={{ backgroundColor: '#2563eb' }}
          >
            ＋ Add Window
          </button>
          <button
            type="button"
            onClick={() =>
              setDialog({
                type: 'clear_tab',
                idx: activeTabIdx,
                name: activeTab.tab_name,
              })
            }
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90"
            style={{ backgroundColor: '#dc2626' }}
            title="Clear all windows in this tab"
          >
            🗑 Clear All Windows
          </button>
          <button
            type="button"
            onClick={() => onToggleOrient(activeTabIdx)}
            className="px-2.5 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-90"
            style={{
              backgroundColor:
                activeTab.orient === 'horizontal' ? '#7c3aed' : '#1a4fb5',
            }}
          >
            {activeTab.orient === 'horizontal' ? '⬜ Horizontal' : '⬛ Vertical'}
          </button>
        </div>
      </div>

      {/* ── WINDOWS CANVAS (#f0f2f8) ── */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <OverlayLayer
          id="gui1_canvas"
          enabled={overlayMode}
          item={overlaysMap.gui1_canvas}
          fallbackTitle="GUI1 Note Windows Canvas"
          onEdit={onEditOverlay}
          align="center"
        />
        <div
          className={`flex-1 overflow-auto p-2 ${
            activeTab.orient === 'horizontal'
              ? 'flex flex-row items-stretch gap-2 overflow-x-auto overflow-y-hidden'
              : 'flex flex-col gap-2 overflow-y-auto overflow-x-hidden'
          }`}
          style={{ backgroundColor: '#f0f2f8' }}
        >
        {activeTab.windows.map((win, wIdx) => {
          const isFocused = wIdx === focusedIdx;
          const wrapMode = win.meta.wrap || 'word';
          const isInlineOriginal = Boolean(inlineOriginalByWin[win.id]);
          const inlineOriginalText = isInlineOriginal
            ? formatWindowOriginalForm(win.content, wIdx + 1, activeTab.tab_name).text
            : '';
          return (
            <div
              key={win.id}
              ref={(el) => {
                windowRefs.current[win.id] = el;
              }}
              onClick={() => onFocusWindow(activeTabIdx, wIdx)}
              className="relative flex flex-col shrink-0"
              style={{
                backgroundColor: '#ffffff',
                border: isFocused ? '2px solid #1a4fb5' : '1px solid #bec8de',
                height:
                  activeTab.orient === 'vertical' ? `${win.meta.height}px` : '100%',
                width:
                  activeTab.orient === 'horizontal'
                    ? `${win.meta.win_width}px`
                    : '100%',
                minHeight: activeTab.orient === 'vertical' ? `${MIN_WIN_HEIGHT}px` : undefined,
              }}
            >
              {/* Window Header (#dde8ff) */}
              <div
                className="flex items-center justify-between px-2 py-1 shrink-0"
                style={{ backgroundColor: '#dde8ff', height: '28px' }}
              >
                <span className="text-xs font-bold" style={{ color: '#1a4fb5' }}>
                  ✦ Window {wIdx + 1}
                </span>

                <div
                  className="flex items-center gap-1 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWindowMeta(activeTabIdx, wIdx, {
                        font_size: Math.min(36, win.meta.font_size + 1),
                      })
                    }
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#e4ebf8', color: '#1a4fb5' }}
                    title="Increase font size"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWindowMeta(activeTabIdx, wIdx, {
                        font_size: Math.max(7, win.meta.font_size - 1),
                      })
                    }
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#e4ebf8', color: '#1a4fb5' }}
                    title="Decrease font size"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWindowMeta(activeTabIdx, wIdx, { bold: !win.meta.bold })
                    }
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer"
                    style={{
                      backgroundColor: win.meta.bold ? '#1a4fb5' : '#e4ebf8',
                      color: win.meta.bold ? '#ffffff' : '#1a4fb5',
                    }}
                    title="Toggle Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWindowMeta(activeTabIdx, wIdx, {
                        italic: !win.meta.italic,
                      })
                    }
                    className="px-1.5 py-0.5 text-[11px] italic font-bold cursor-pointer"
                    style={{
                      backgroundColor: win.meta.italic ? '#1a4fb5' : '#e4ebf8',
                      color: win.meta.italic ? '#ffffff' : '#1a4fb5',
                    }}
                    title="Toggle Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setColorPickerWin(colorPickerWin === wIdx ? null : wIdx)
                    }
                    className="px-1.5 py-0.5 text-[11px] cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#e4ebf8', color: '#1a4fb5' }}
                    title="Font colour"
                  >
                    🎨
                  </button>
                  <button
                    type="button"
                    onClick={() => setOriginalFormModal({ activeTab: wIdx + 1 })}
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
                    title="Original Form popup view"
                  >
                    📊 Original Form
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onFocusWindow(activeTabIdx, wIdx);
                      setInlineOriginalByWin((prev) => ({
                        ...prev,
                        [win.id]: !prev[win.id],
                      }));
                    }}
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{
                      backgroundColor: isInlineOriginal ? '#1a4fb5' : '#fef3c7',
                      color: isInlineOriginal ? '#ffffff' : '#92400e',
                    }}
                    title={
                      isInlineOriginal
                        ? 'Switch back to JSON / raw notes in this window'
                        : 'Show Original Form inside this same window'
                    }
                  >
                    {isInlineOriginal ? '🔁 JSON View' : '🔁 Original View'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: 'clear_window', winIdx: wIdx })}
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                    title={`Clear Window ${wIdx + 1}`}
                  >
                    🗑 Clear
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({
                        winIdx: wIdx,
                        x: Math.min(rect.left, window.innerWidth - 230),
                        y: Math.min(rect.bottom + 4, window.innerHeight - 360),
                      });
                    }}
                    className="px-1.5 py-0.5 text-[11px] font-bold cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: '#e4ebf8', color: '#1a4fb5' }}
                    title="Window options (or right-click text)"
                  >
                    ⋮
                  </button>

                  {colorPickerWin === wIdx && (
                    <div
                      className="absolute right-0 top-7 z-30 p-2 bg-white border shadow-lg flex items-center gap-1.5"
                      style={{ borderColor: '#bec8de' }}
                    >
                      {FONT_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            onUpdateWindowMeta(activeTabIdx, wIdx, { font_color: hex });
                            setColorPickerWin(null);
                          }}
                          className="w-5 h-5 border border-slate-300 cursor-pointer"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                      <input
                        type="color"
                        value={win.meta.font_color}
                        onChange={(e) =>
                          onUpdateWindowMeta(activeTabIdx, wIdx, {
                            font_color: e.target.value,
                          })
                        }
                        className="w-6 h-6 cursor-pointer border-0 p-0"
                        title="Custom colour"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Editable Textarea OR Inline Original Form View */}
              {isInlineOriginal ? (
                <textarea
                  readOnly
                  value={inlineOriginalText}
                  onFocus={() => onFocusWindow(activeTabIdx, wIdx)}
                  spellCheck={false}
                  className="flex-1 w-full p-2 resize-none focus:outline-none select-text"
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#1e293b',
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: `${win.meta.font_size}pt`,
                    whiteSpace: wrapMode === 'none' ? 'pre' : 'pre-wrap',
                    wordBreak: wrapMode === 'char' ? 'break-all' : 'normal',
                    overflowX: wrapMode === 'none' ? 'auto' : 'hidden',
                  }}
                />
              ) : (
                <textarea
                  ref={(el) => {
                    textareaRefs.current[win.id] = el;
                  }}
                  value={win.content}
                  onFocus={() => onFocusWindow(activeTabIdx, wIdx)}
                  onChange={(e) =>
                    onUpdateWindowContent(activeTabIdx, wIdx, e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.ctrlKey && e.key === 'ArrowUp') {
                      e.preventDefault();
                      scrollToWindow(Math.max(0, wIdx - 1));
                    } else if (e.ctrlKey && e.key === 'ArrowDown') {
                      e.preventDefault();
                      scrollToWindow(
                        Math.min(activeTab.windows.length - 1, wIdx + 1)
                      );
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      winIdx: wIdx,
                      x: Math.min(e.clientX, window.innerWidth - 230),
                      y: Math.min(e.clientY, window.innerHeight - 360),
                    });
                  }}
                  spellCheck={false}
                  placeholder={`Window ${wIdx + 1} notes or JSON...`}
                  className="flex-1 w-full p-2 resize-none focus:outline-none select-text"
                  style={{
                    backgroundColor: '#ffffff',
                    color: win.meta.font_color,
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: `${win.meta.font_size}pt`,
                    fontWeight: win.meta.bold ? 700 : 400,
                    fontStyle: win.meta.italic ? 'italic' : 'normal',
                    whiteSpace:
                      wrapMode === 'none'
                        ? 'pre'
                        : wrapMode === 'char'
                          ? 'pre-wrap'
                          : 'pre-wrap',
                    wordBreak: wrapMode === 'char' ? 'break-all' : 'normal',
                    overflowX: wrapMode === 'none' ? 'auto' : 'hidden',
                  }}
                />
              )}

              {/* Drag Resize Handle */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  dragRef.current = {
                    winIdx: wIdx,
                    orient: activeTab.orient,
                    startCoord:
                      activeTab.orient === 'vertical' ? e.clientY : e.clientX,
                    startSize:
                      activeTab.orient === 'vertical'
                        ? win.meta.height
                        : win.meta.win_width,
                  };
                }}
                title="Drag to resize window"
                className={
                  activeTab.orient === 'vertical'
                    ? 'h-1.5 w-full cursor-ns-resize shrink-0'
                    : 'w-1.5 h-full cursor-ew-resize absolute right-0 top-7 bottom-0'
                }
                style={{ backgroundColor: '#bcc8e0' }}
              />
            </div>
          );
        })}
        </div>
      </div>

      {/* ── BOTTOM NAV BAR (#eaedf5) ── */}
      <div
        className="relative flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t"
        style={{ backgroundColor: '#eaedf5', borderColor: '#bec8de' }}
      >
        <OverlayLayer
          id="gui1_navbar"
          enabled={overlayMode}
          item={overlaysMap.gui1_navbar}
          fallbackTitle="GUI1 Window Navigator"
          onEdit={onEditOverlay}
        />
        <button
          type="button"
          disabled={focusedIdx <= 0}
          onClick={() => scrollToWindow(Math.max(0, focusedIdx - 1))}
          className="px-2.5 py-1 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
          style={{
            backgroundColor: focusedIdx > 0 ? '#1a4fb5' : '#dde3f0',
            color: focusedIdx > 0 ? '#ffffff' : '#1e3a5f',
          }}
        >
          ◀ Prev
        </button>
        <button
          type="button"
          disabled={focusedIdx >= activeTab.windows.length - 1}
          onClick={() =>
            scrollToWindow(Math.min(activeTab.windows.length - 1, focusedIdx + 1))
          }
          className="px-2.5 py-1 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-default"
          style={{
            backgroundColor:
              focusedIdx < activeTab.windows.length - 1 ? '#1a4fb5' : '#dde3f0',
            color:
              focusedIdx < activeTab.windows.length - 1 ? '#ffffff' : '#1e3a5f',
          }}
        >
          Next ▶
        </button>

        <span className="text-xs font-bold px-2" style={{ color: '#1a4fb5' }}>
          Window {focusedIdx + 1}/{activeTab.windows.length}
        </span>

        <div className="flex items-center gap-1 flex-wrap">
          {activeTab.windows.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => scrollToWindow(i)}
              className="px-2 py-0.5 text-[11px] font-bold cursor-pointer"
              style={{
                backgroundColor: i === focusedIdx ? '#1a4fb5' : '#dde3f0',
                color: i === focusedIdx ? '#ffffff' : '#1e3a5f',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* ── RIGHT-CLICK / QUICK CONTEXT MENU ── */}
      {contextMenu && activeTab.windows[contextMenu.winIdx] && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-56 bg-white border shadow-xl py-1 text-xs"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            borderColor: '#bec8de',
            color: '#333344',
          }}
        >
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(
                activeTab.windows[contextMenu.winIdx].content
              );
              onStatus(`📋 Copied Window ${contextMenu.winIdx + 1} text`);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            ⬚ Copy All Text
          </button>
          <button
            type="button"
            onClick={() => {
              setOriginalFormModal({ activeTab: contextMenu.winIdx + 1 });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            📊 Original Form
          </button>
          <button
            type="button"
            onClick={() => {
              setDialog({ type: 'clear_window', winIdx: contextMenu.winIdx });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            ⌦ Clear Window
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            onClick={() => {
              insertIntoWindow(
                contextMenu.winIdx,
                new Date().toISOString().slice(0, 10)
              );
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            📅 Insert Date
          </button>
          <button
            type="button"
            onClick={() => {
              insertIntoWindow(
                contextMenu.winIdx,
                new Date().toTimeString().slice(0, 8)
              );
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            🕐 Insert Time
          </button>
          <button
            type="button"
            onClick={() => {
              insertIntoWindow(
                contextMenu.winIdx,
                `\n${'─'.repeat(50)}\n`
              );
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            ─ Insert Divider
          </button>
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            onClick={() => {
              const src = activeTab.windows[contextMenu.winIdx];
              onAddWindow(activeTabIdx, src.content, { ...src.meta });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#1a4fb5] hover:text-white cursor-pointer"
          >
            ⧉ Duplicate This Window
          </button>
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400">
            HEIGHT / WIDTH / WRAP
          </div>
          <div className="flex flex-wrap gap-1 px-3 pb-1.5">
            {[
              ['120px', 120],
              ['210px', 210],
              ['340px', 340],
              ['480px', 480],
            ].map(([lbl, h]) => (
              <button
                key={String(lbl)}
                type="button"
                onClick={() => {
                  onUpdateWindowMeta(activeTabIdx, contextMenu.winIdx, {
                    height: Number(h),
                  });
                  setContextMenu(null);
                }}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-[#1a4fb5] hover:text-white text-[10px] cursor-pointer"
              >
                H:{lbl}
              </button>
            ))}
            {(['word', 'char', 'none'] as WrapMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  onUpdateWindowMeta(activeTabIdx, contextMenu.winIdx, {
                    wrap: mode,
                  });
                  setContextMenu(null);
                }}
                className="px-1.5 py-0.5 bg-slate-100 hover:bg-[#1a4fb5] hover:text-white text-[10px] cursor-pointer"
              >
                Wrap:{mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DIALOG MODALS (Replaces tkinter simpledialog/messagebox) ── */}
      {dialog && (
        <div
          onClick={() => {
            if (!isSaving) setDialog(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border shadow-2xl w-full max-w-md p-5"
            style={{ borderColor: '#bec8de', fontFamily: 'system-ui, sans-serif' }}
          >
            {dialog.type === 'new_project' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  🆕 New Project
                </h3>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Project name:
                </label>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ ...dialog, name: e.target.value })
                  }
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-3"
                />
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Project folder label:
                </label>
                <input
                  type="text"
                  value={dialog.dir}
                  onChange={(e) =>
                    setDialog({ ...dialog, dir: e.target.value })
                  }
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.name.trim()) {
                        onNewProject(dialog.name.trim(), dialog.dir.trim() || saveDir);
                      }
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: '#6d28d9' }}
                  >
                    Create Project
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'set_dir' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  📁 Set Default Project Directory
                </h3>
                <input
                  type="text"
                  value={dialog.dir}
                  onChange={(e) =>
                    setDialog({ ...dialog, dir: e.target.value })
                  }
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.dir.trim()) onSetSaveDir(dialog.dir.trim());
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: '#7c3aed' }}
                  >
                    Save Directory
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'add_tab' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  New Tab
                </h3>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tab name:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ ...dialog, name: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dialog.name.trim()) {
                      onAddTab(dialog.name.trim());
                      setDialog(null);
                    }
                  }}
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.name.trim()) onAddTab(dialog.name.trim());
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: '#22c55e' }}
                  >
                    Add Tab
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'rename_tab' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  Rename Tab
                </h3>
                <input
                  type="text"
                  autoFocus
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ ...dialog, name: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dialog.name.trim()) {
                      onRenameTab(dialog.idx, dialog.name.trim());
                      setDialog(null);
                    }
                  }}
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-4"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.name.trim())
                        onRenameTab(dialog.idx, dialog.name.trim());
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: '#1a4fb5' }}
                  >
                    Rename
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'close_tab' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Close Tab
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Close tab &apos;{dialog.name}&apos;? All content will be lost.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCloseTab(dialog.idx);
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 cursor-pointer"
                  >
                    Close Tab
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'clear_tab' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Clear Tab
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Clear all windows in &apos;{dialog.name}&apos;?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearTab(dialog.idx);
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 cursor-pointer"
                  >
                    Clear All Windows
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'clear_window' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  Clear Window
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Clear all text in Window {dialog.winIdx + 1}?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateWindowContent(activeTabIdx, dialog.winIdx, '');
                      setDialog(null);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'save_project' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  💾 Save Project (.notetool)
                </h3>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Directory to save:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={dialog.dir}
                  onChange={(e) =>
                    setDialog({ ...dialog, dir: e.target.value, error: undefined })
                  }
                  placeholder="workspace"
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-3 font-mono"
                />
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  File / project name:
                </label>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ ...dialog, name: e.target.value, error: undefined })
                  }
                  placeholder="NoteTool_Project"
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-2 font-mono"
                />
                <p className="text-[11px] text-slate-500 mb-3 font-mono">
                  Target: saved_projects/{dialog.dir.trim() || 'workspace'}/
                  {(dialog.name.trim().replace(/\.notetool$/i, '') || 'NoteTool_Project')}.notetool
                </p>
                {dialog.error && (
                  <p className="text-xs text-red-600 font-semibold mb-3">{dialog.error}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (!dialog.dir.trim() || !dialog.name.trim()) {
                        setDialog({
                          ...dialog,
                          error: 'Please enter both a directory and a file name.',
                        });
                        return;
                      }
                      setIsSaving(true);
                      try {
                        await onSaveProject(dialog.dir, dialog.name, false);
                        setDialog(null);
                      } catch (err) {
                        setDialog({ ...dialog, error: String(err) });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#0f766e' }}
                  >
                    {isSaving ? 'Saving...' : 'Save to Directory'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (!dialog.dir.trim() || !dialog.name.trim()) {
                        setDialog({
                          ...dialog,
                          error: 'Please enter both a directory and a file name.',
                        });
                        return;
                      }
                      setIsSaving(true);
                      try {
                        await onSaveProject(dialog.dir, dialog.name, true);
                        setDialog(null);
                      } catch (err) {
                        setDialog({ ...dialog, error: String(err) });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#1a4fb5' }}
                  >
                    {isSaving ? 'Saving...' : 'Save & Download .notetool'}
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'save_all_txt' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  💾 Save All Tabs (.txt Export)
                </h3>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Directory to save:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={dialog.dir}
                  onChange={(e) =>
                    setDialog({ ...dialog, dir: e.target.value, error: undefined })
                  }
                  placeholder="workspace"
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-3 font-mono"
                />
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Save name (combined file prefix):
                </label>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(e) =>
                    setDialog({ ...dialog, name: e.target.value, error: undefined })
                  }
                  placeholder="note_tool"
                  className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-2 font-mono"
                />
                <p className="text-[11px] text-slate-500 mb-3 font-mono">
                  Target: saved_projects/{dialog.dir.trim() || 'workspace'}/
                  {(dialog.name.trim().replace(/\.txt$/i, '') || 'note_tool')}_all_tabs.txt + {tabs.length} tab .txt files
                </p>
                {dialog.error && (
                  <p className="text-xs text-red-600 font-semibold mb-3">{dialog.error}</p>
                )}
                <div className="max-h-44 overflow-y-auto border border-slate-200 divide-y divide-slate-200 mb-4">
                  {tabs.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-3 py-1.5 text-xs"
                    >
                      <span className="font-mono font-semibold text-slate-800">
                        {noteSlug(t.tab_name)}.txt
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadSingleTxt(t)}
                        className="px-2 py-0.5 text-white font-semibold cursor-pointer"
                        style={{ backgroundColor: '#15803d' }}
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (!dialog.dir.trim() || !dialog.name.trim()) {
                        setDialog({
                          ...dialog,
                          error: 'Please enter both a directory and a save name.',
                        });
                        return;
                      }
                      setIsSaving(true);
                      try {
                        await onSaveAll(dialog.dir, dialog.name, false);
                        setDialog(null);
                      } catch (err) {
                        setDialog({ ...dialog, error: String(err) });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#15803d' }}
                  >
                    {isSaving ? 'Saving...' : 'Save All to Directory'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      if (!dialog.dir.trim() || !dialog.name.trim()) {
                        setDialog({
                          ...dialog,
                          error: 'Please enter both a directory and a save name.',
                        });
                        return;
                      }
                      setIsSaving(true);
                      try {
                        await onSaveAll(dialog.dir, dialog.name, true);
                        setDialog(null);
                      } catch (err) {
                        setDialog({ ...dialog, error: String(err) });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#1a4fb5' }}
                  >
                    {isSaving ? 'Saving...' : 'Save & Download Combined .txt'}
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'warning' && (
              <>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {dialog.title}
                </h3>
                <p className="text-sm text-slate-600 mb-4">{dialog.message}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: '#1a4fb5' }}
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── ORIGINAL FORM MULTI-WINDOW POPUP ── */}
      {originalFormModal && (() => {
        const allWinEntries = activeTab.windows.map((w, idx) => ({
          windowId: idx + 1,
          content: w.content,
        }));
        const allCombinedText = formatAllWindowsOriginalForm(
          allWinEntries,
          activeTab.tab_name
        );
        const currentTab = originalFormModal.activeTab;
        const currentViewText =
          currentTab === 'all'
            ? allCombinedText
            : formatWindowOriginalForm(
                activeTab.windows[currentTab - 1]?.content ?? '',
                currentTab,
                activeTab.tab_name
              ).text;
        const populatedCount = allWinEntries.filter((w) => w.content.trim()).length;

        return (
          <div
            onClick={() => setOriginalFormModal(null)}
            className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border shadow-2xl w-full max-w-5xl h-[82vh] flex flex-col p-4"
              style={{
                borderColor: '#bec8de',
                fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
              }}
            >
              {/* Header + Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    📊 Original Form — {activeTab.tab_name}{' '}
                    {currentTab === 'all'
                      ? `/ All Windows (1-${activeTab.windows.length})`
                      : `/ Window ${currentTab}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentTab === 'all'
                      ? `All windows in '${activeTab.tab_name}' (${populatedCount}/${activeTab.windows.length} non-empty)`
                      : `Formatted view of Window ${currentTab} (${populatedCount}/${activeTab.windows.length} non-empty across tab)`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {currentTab !== 'all' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          scrollToWindow(currentTab - 1);
                          setOriginalFormModal(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:brightness-95"
                        style={{ backgroundColor: '#e4ebf8', color: '#1a4fb5' }}
                      >
                        🎯 Focus Window {currentTab}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onFocusWindow(activeTabIdx, currentTab - 1);
                          setOriginalFormModal(null);
                          onLaunchGenerator();
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold text-white cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: '#2563eb' }}
                      >
                        ⚡ Generate Data
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(currentViewText);
                      triggerCopyBlink('current');
                      onStatus('📋 Copied Original Form view to clipboard');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                      copiedBlinkBtn === 'current'
                        ? 'copy-btn-blink'
                        : 'hover:bg-slate-200'
                    }`}
                    style={
                      copiedBlinkBtn === 'current'
                        ? undefined
                        : { backgroundColor: '#f1f5f9', color: '#0f172a' }
                    }
                  >
                    {copiedBlinkBtn === 'current'
                      ? '✓ Copied Current!'
                      : '📋 Copy Current'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(allCombinedText);
                      triggerCopyBlink('all');
                      onStatus('📋 Copied All Windows Original Form to clipboard');
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                      copiedBlinkBtn === 'all'
                        ? 'copy-btn-blink'
                        : 'hover:bg-slate-200'
                    }`}
                    style={
                      copiedBlinkBtn === 'all'
                        ? undefined
                        : { backgroundColor: '#f1f5f9', color: '#0f172a' }
                    }
                  >
                    {copiedBlinkBtn === 'all'
                      ? '✓ Copied All Windows!'
                      : '📋 Copy All Windows'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([currentViewText], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${noteSlug(activeTab.tab_name)}_${
                        currentTab === 'all' ? 'all_windows' : `window${currentTab}`
                      }_original_form.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-white cursor-pointer hover:opacity-95"
                    style={{ backgroundColor: '#15803d' }}
                  >
                    ⬇ Download .txt
                  </button>
                  <button
                    type="button"
                    onClick={() => setOriginalFormModal(null)}
                    className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#1a4fb5' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Multi-Window Tabs */}
              <div
                className="flex items-center gap-1 pt-2 overflow-x-auto border-b border-slate-200 shrink-0"
                style={{ backgroundColor: '#f8fafc' }}
              >
                <button
                  type="button"
                  onClick={() => setOriginalFormModal({ activeTab: 'all' })}
                  className="px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0 border-t-2"
                  style={{
                    backgroundColor: currentTab === 'all' ? '#ffffff' : '#e2e8f0',
                    color: currentTab === 'all' ? '#1a4fb5' : '#475569',
                    borderTopColor: currentTab === 'all' ? '#1a4fb5' : 'transparent',
                  }}
                >
                  🗂 All Windows (1-{activeTab.windows.length})
                </button>
                {allWinEntries.map(({ windowId, content }) => {
                  const isActive = currentTab === windowId;
                  const hasData = Boolean(content.trim());
                  return (
                    <button
                      key={windowId}
                      type="button"
                      onClick={() => setOriginalFormModal({ activeTab: windowId })}
                      className="px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0 border-t-2 flex items-center gap-1.5"
                      style={{
                        backgroundColor: isActive ? '#ffffff' : '#e2e8f0',
                        color: isActive ? '#1a4fb5' : '#475569',
                        borderTopColor: isActive ? '#1a4fb5' : 'transparent',
                      }}
                    >
                      <span>Window {windowId}</span>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: hasData ? '#15803d' : '#94a3b8',
                        }}
                        title={hasData ? 'Has content' : 'Empty'}
                      />
                    </button>
                  );
                })}
              </div>

              <textarea
                readOnly
                value={currentViewText}
                className="flex-1 mt-3 p-3 border text-xs resize-none focus:outline-none select-text"
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#bec8de',
                  fontFamily: "'Courier New', Courier, monospace",
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* ── GUI1 TEXT-FILE HELP MODAL ── */}
      {helpOpen && (
        <TextHelpModal
          docId="gui1"
          title="❓ GUI1 Help — Note Tool Workspace"
          accentColor="#1a4fb5"
          defaultText={DEFAULT_GUI1_HELP_TXT}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
};
