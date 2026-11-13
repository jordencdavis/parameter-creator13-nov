import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OverlayLayer, TextHelpModal } from './HelpAndOverlay';
import { JsonCreatorStudioModal } from './JsonCreatorStudioModal';
import { createStarterConfig } from '../data/defaultConfigs';
import {
  formatAllWindowsOriginalForm,
  formatWindowOriginalForm,
  generateCurrentJson,
  getInitialFieldValues,
} from '../utils/generators';
import { DEFAULT_GUI2_HELP_TXT, type OverlayMap } from '../utils/helpContent';
import type {
  ConfigField,
  OutputHistoryEntry,
  TabConfigSchema,
} from '../types/app';

const TOTAL_WINDOWS_PER_TAB = 7;

interface MasterTabInfo {
  id: string;
  slug: string;
  title: string;
  windowCount: number;
}

interface JsonGeneratorGui2Props {
  configs: Record<string, TabConfigSchema>;
  configOrder: string[];
  masterTabs: MasterTabInfo[];
  projectId: string;
  activeTabSlug: string;
  selectedTabName: string;
  selectedWindowId: number;
  currentRequestId: string | null;
  windowDataStore: Record<string, Record<number, string>>;
  statusText: string;
  statusTone: 'neutral' | 'accent' | 'success' | 'danger';
  history: OutputHistoryEntry[];
  overlayMode: boolean;
  overlaysMap: OverlayMap;
  onEditOverlay: (id: string) => void;
  onSwitchTab: (tabSlug: string) => void;
  onSelectTargetWindow: (winId: number) => void;
  onUpdateWindowData: (tabSlug: string, winId: number, jsonStr: string) => void;
  onClearAllWindows: (tabSlug: string) => void;
  onReloadConfigs: () => Promise<void>;
  onSaveConfig: (tabSlug: string, cfg: TabConfigSchema) => Promise<void>;
  onCreateStarterConfig: (tabSlug: string, cfg: TabConfigSchema) => Promise<void>;
  defaultDownloadDir: string;
  defaultDownloadFileName: string;
  onDownloadTxtWithLocation: (
    dir: string,
    fileName: string,
    content: string,
    alsoDownloadBrowser: boolean
  ) => Promise<void>;
  onSendSingleWindow: (
    tabSlug: string,
    winId: number,
    jsonStr: string,
    recordCount: number
  ) => Promise<void>;
  onSendAllWindows: (
    tabSlug: string,
    allWindows: Record<number, string>
  ) => Promise<void>;
}

export const JsonGeneratorGui2: React.FC<JsonGeneratorGui2Props> = ({
  configs,
  configOrder,
  masterTabs,
  projectId,
  activeTabSlug,
  selectedTabName,
  selectedWindowId,
  currentRequestId,
  windowDataStore,
  statusText,
  statusTone,
  history,
  overlayMode,
  overlaysMap,
  onEditOverlay,
  onSwitchTab,
  onSelectTargetWindow,
  onUpdateWindowData,
  onClearAllWindows,
  onReloadConfigs,
  onSaveConfig,
  onCreateStarterConfig,
  defaultDownloadDir,
  defaultDownloadFileName,
  onDownloadTxtWithLocation,
  onSendSingleWindow,
  onSendAllWindows,
}) => {
  // Per-tab field values: { [tabSlug]: { [fieldId]: value } }
  const [fieldValuesByTab, setFieldValuesByTab] = useState<
    Record<string, Record<string, string | number | string[]>>
  >({});

  // Per-tab include/exclude ticks: { [tabSlug]: { [fieldId]: boolean } }
  const [includedFieldsByTab, setIncludedFieldsByTab] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // Popups
  const [livePreviewOpen, setLivePreviewOpen] = useState(false);
  const [originalFormModal, setOriginalFormModal] = useState<{
    activeTab: 'all' | number;
  } | null>(null);
  const [downloadTxtModal, setDownloadTxtModal] = useState<{
    dir: string;
    fileName: string;
    content: string;
    error: string | null;
    saving: boolean;
  } | null>(null);
  const [configEditorModal, setConfigEditorModal] = useState<{
    tabSlug: string;
    rawJson: string;
    error: string | null;
  } | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState<boolean>(false);
  const [inlineOriginalByWin, setInlineOriginalByWin] = useState<
    Record<string, boolean>
  >({});
  const [copiedWinKey, setCopiedWinKey] = useState<string | null>(null);
  const copyBlinkTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const windowCardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    return () => {
      if (copyBlinkTimeoutRef.current !== null) {
        window.clearTimeout(copyBlinkTimeoutRef.current);
      }
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const displayTabs: MasterTabInfo[] = useMemo(() => {
    if (masterTabs.length > 0) return masterTabs;
    const base = configOrder.length ? [...configOrder] : Object.keys(configs);
    if (activeTabSlug && !base.includes(activeTabSlug)) {
      base.push(activeTabSlug);
    }
    return base.map((slug) => ({
      id: slug,
      slug,
      title:
        configs[slug]?.tab_title ??
        slug
          .split('_')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' '),
      windowCount: TOTAL_WINDOWS_PER_TAB,
    }));
  }, [masterTabs, configOrder, configs, activeTabSlug]);

  const activeMasterTab = useMemo(
    () => displayTabs.find((t) => t.slug === activeTabSlug),
    [displayTabs, activeTabSlug]
  );

  const totalWindows = Math.max(
    TOTAL_WINDOWS_PER_TAB,
    activeMasterTab?.windowCount ?? TOTAL_WINDOWS_PER_TAB
  );

  const savedCfg = configs[activeTabSlug];
  const isUsingStarterSchema = !savedCfg;
  const activeCfg: TabConfigSchema = useMemo(() => {
    if (savedCfg) return savedCfg;
    const starter = createStarterConfig(activeTabSlug);
    return {
      ...starter,
      tab_title: selectedTabName || starter.tab_title,
    };
  }, [savedCfg, activeTabSlug, selectedTabName]);

  // Ensure active tab has initialized field values whenever configs/tabs change
  useEffect(() => {
    setFieldValuesByTab((prev) => {
      if (prev[activeTabSlug]) return prev;
      return {
        ...prev,
        [activeTabSlug]: getInitialFieldValues(activeCfg),
      };
    });
  }, [activeTabSlug, activeCfg]);

  // Scroll target window card into view only when dispatched from GUI1 IPC
  useEffect(() => {
    if (!currentRequestId) return;
    const el = windowCardRefs.current[selectedWindowId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentRequestId]);

  // Esc closes any active GUI2 modal (top-most first)
  useEffect(() => {
    if (
      !downloadTxtModal &&
      !livePreviewOpen &&
      !originalFormModal &&
      !configEditorModal &&
      !historyModalOpen
    ) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (downloadTxtModal) {
        if (!downloadTxtModal.saving) setDownloadTxtModal(null);
        return;
      }
      if (livePreviewOpen) setLivePreviewOpen(false);
      if (originalFormModal) setOriginalFormModal(null);
      if (configEditorModal) setConfigEditorModal(null);
      if (historyModalOpen) setHistoryModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    downloadTxtModal,
    livePreviewOpen,
    originalFormModal,
    configEditorModal,
    historyModalOpen,
  ]);

  const showToast = (msg: string, isError = false) => {
    setToastMsg(msg);
    setToastIsError(isError);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMsg(null);
      setToastIsError(false);
    }, 3000);
  };

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

  const triggerCopyBlink = (winKey: string) => {
    setCopiedWinKey(null);
    window.requestAnimationFrame(() => {
      setCopiedWinKey(winKey);
    });
    if (copyBlinkTimeoutRef.current !== null) {
      window.clearTimeout(copyBlinkTimeoutRef.current);
    }
    copyBlinkTimeoutRef.current = window.setTimeout(() => {
      setCopiedWinKey(null);
    }, 1400);
  };

  const validateWindowSendData = (
    raw: string
  ): { ok: boolean; reason?: string; recordCount: number } => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        ok: false,
        reason: 'No data entered. Input valid data or click "⚡ Gen JSON" first.',
        recordCount: 0,
      };
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as { data?: unknown } | unknown[];
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            return {
              ok: false,
              reason: 'JSON array is empty. Add valid records before sending.',
              recordCount: 0,
            };
          }
          return { ok: true, recordCount: parsed.length };
        }
        if (parsed && typeof parsed === 'object') {
          if (Object.keys(parsed).length === 0) {
            return {
              ok: false,
              reason: 'JSON object is empty ({}). Add valid data before sending.',
              recordCount: 0,
            };
          }
          if ('data' in parsed && Array.isArray(parsed.data)) {
            if (parsed.data.length === 0) {
              return {
                ok: false,
                reason: 'JSON "data" array is empty. Add records before sending.',
                recordCount: 0,
              };
            }
            return { ok: true, recordCount: parsed.data.length };
          }
          return { ok: true, recordCount: 1 };
        }
      } catch (err) {
        return {
          ok: false,
          reason: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          recordCount: 0,
        };
      }
    }
    const nonEmptyLines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return { ok: true, recordCount: Math.max(1, nonEmptyLines.length) };
  };

  const sendValidatedWindow = async (winId: number) => {
    const rawVal = windowDataStore[activeTabSlug]?.[winId] ?? '';
    const check = validateWindowSendData(rawVal);
    if (!check.ok) {
      showToast(`⚠️ window${winId}: ${check.reason}`, true);
      return;
    }
    await onSendSingleWindow(activeTabSlug, winId, rawVal, check.recordCount);
  };

  // Deduplicate duplicate fields like communication.json's duplicate protocol_type
  const uniqueFields: ConfigField[] = useMemo(() => {
    if (!activeCfg) return [];
    const seen = new Set<string>();
    const list: ConfigField[] = [];
    for (const f of activeCfg.fields) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        list.push(f);
      }
    }
    return list;
  }, [activeCfg]);

  const currentFieldVals = useMemo(() => {
    return (
      fieldValuesByTab[activeTabSlug] ?? getInitialFieldValues(activeCfg)
    );
  }, [fieldValuesByTab, activeTabSlug, activeCfg]);

  const updateFieldValue = (
    fieldId: string,
    value: string | number | string[]
  ) => {
    setFieldValuesByTab((prev) => ({
      ...prev,
      [activeTabSlug]: {
        ...(prev[activeTabSlug] ?? getInitialFieldValues(activeCfg)),
        [fieldId]: value,
      },
    }));
  };

  const toggleCheckboxOption = (fieldId: string, option: string) => {
    const existing = Array.isArray(currentFieldVals[fieldId])
      ? (currentFieldVals[fieldId] as string[])
      : [];
    const next = existing.includes(option)
      ? existing.filter((o) => o !== option)
      : [...existing, option];
    updateFieldValue(fieldId, next);
  };

  const includedFieldIds = useMemo(() => {
    const tabMap = includedFieldsByTab[activeTabSlug] ?? {};
    return uniqueFields
      .filter((f) => tabMap[f.id] !== false)
      .map((f) => f.id);
  }, [includedFieldsByTab, activeTabSlug, uniqueFields]);

  const toggleFieldIncluded = (fieldId: string) => {
    setIncludedFieldsByTab((prev) => {
      const currTab = prev[activeTabSlug] ?? {};
      const nextVal = currTab[fieldId] === false;
      return {
        ...prev,
        [activeTabSlug]: {
          ...currTab,
          [fieldId]: nextVal,
        },
      };
    });
  };

  const setAllFieldsIncluded = (includeAll: boolean) => {
    setIncludedFieldsByTab((prev) => {
      const nextTab: Record<string, boolean> = {};
      for (const f of uniqueFields) {
        nextTab[f.id] = includeAll;
      }
      return {
        ...prev,
        [activeTabSlug]: nextTab,
      };
    });
  };

  const livePreviewPayload = useMemo(() => {
    if (!activeCfg) return null;
    return generateCurrentJson({
      tabSlug: activeTabSlug,
      cfg: activeCfg,
      fieldVals: currentFieldVals,
      includedFieldIds,
      windowId: selectedWindowId,
      projectId,
      requestId: currentRequestId,
    });
  }, [
    activeCfg,
    activeTabSlug,
    currentFieldVals,
    includedFieldIds,
    selectedWindowId,
    projectId,
    currentRequestId,
  ]);

  const livePreviewStr = useMemo(
    () => (livePreviewPayload ? JSON.stringify(livePreviewPayload, null, 2) : ''),
    [livePreviewPayload]
  );

  const handlePopulateWindow = (winId: number) => {
    if (!activeCfg) return;
    const obj = generateCurrentJson({
      tabSlug: activeTabSlug,
      cfg: activeCfg,
      fieldVals: currentFieldVals,
      includedFieldIds,
      windowId: winId,
      projectId,
      requestId: currentRequestId,
    });
    const str = JSON.stringify(obj, null, 2);
    onUpdateWindowData(activeTabSlug, winId, str);
    return { str, count: obj.data.length };
  };

  const handlePopulateAllWindows = () => {
    if (!activeCfg) return {};
    const batch: Record<number, string> = {};
    for (let wid = 1; wid <= totalWindows; wid++) {
      const obj = generateCurrentJson({
        tabSlug: activeTabSlug,
        cfg: activeCfg,
        fieldVals: currentFieldVals,
        includedFieldIds,
        windowId: wid,
        projectId,
        requestId: currentRequestId,
      });
      const str = JSON.stringify(obj, null, 2);
      batch[wid] = str;
      onUpdateWindowData(activeTabSlug, wid, str);
    }
    return batch;
  };

  const handleOpenConfigEditor = (tabSlug: string) => {
    const cfg = configs[tabSlug] ?? activeCfg;
    if (!cfg) return;
    setConfigEditorModal({
      tabSlug,
      rawJson: JSON.stringify(cfg, null, 2),
      error: null,
    });
  };

  const handleSaveConfigEditor = async () => {
    if (!configEditorModal) return;
    try {
      const parsed = JSON.parse(configEditorModal.rawJson) as TabConfigSchema;
      await onSaveConfig(configEditorModal.tabSlug, parsed);
      // Re-initialize field values from updated config defaults cleanly
      setFieldValuesByTab((prev) => ({
        ...prev,
        [configEditorModal.tabSlug]: getInitialFieldValues(parsed),
      }));
      setConfigEditorModal(null);
      showToast(`✅ Saved & reloaded config/${configEditorModal.tabSlug}.json`);
    } catch (err) {
      setConfigEditorModal({
        ...configEditorModal,
        error: `JSON syntax error: ${String(err)}`,
      });
    }
  };

  const statusColor =
    statusTone === 'success'
      ? '#16a34a'
      : statusTone === 'danger'
        ? '#dc2626'
        : statusTone === 'accent'
          ? '#2563eb'
          : '#475569';

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      {/* ── TOP BANNER (#ffffff) ── */}
      <div
        className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b"
        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
      >
        <OverlayLayer
          id="gui2_banner"
          enabled={overlayMode}
          item={overlaysMap.gui2_banner}
          fallbackTitle="GUI2 Top Banner"
          onEdit={onEditOverlay}
        />
        <div>
          <div className="text-base font-bold" style={{ color: '#0f172a' }}>
            ⚡ GUI2 — Dynamic JSON Generator &amp; Window Canvas
          </div>
          <div className="text-xs" style={{ color: '#475569' }}>
            Project: <span className="font-semibold">{projectId}</span>
            {'  |  '}
            Active Tab: <span className="font-semibold">{selectedTabName}</span>
            {'  |  '}
            Target:{' '}
            <span className="font-semibold" style={{ color: '#2563eb' }}>
              window{selectedWindowId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] font-bold" style={{ color: '#16a34a' }}>
              🟢 Connected to GUI1
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="px-2.5 py-0.5 text-xs cursor-pointer hover:bg-slate-200"
                style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
              >
                📜 History ({history.length})
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onReloadConfigs();
                  showToast('🔄 Reloaded config schemas');
                }}
                className="px-2.5 py-0.5 text-xs cursor-pointer hover:bg-slate-200"
                style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
              >
                🔄 Reload Configs
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="px-2.5 py-0.5 text-xs font-bold cursor-pointer hover:bg-blue-100"
                style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                title="Help — Explain GUI2 and all buttons"
              >
                ❓ Help
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB BAR (#f1f5f9) — Master-synced from GUI1 ── */}
      <div
        className="relative flex items-center gap-0.5 px-2 pt-1 overflow-x-auto border-b"
        style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}
      >
        <OverlayLayer
          id="gui2_tabbar"
          enabled={overlayMode}
          item={overlaysMap.gui2_tabbar}
          fallbackTitle="GUI2 Schema Tabs"
          onEdit={onEditOverlay}
        />
        {displayTabs.map((tab) => {
          const isActive = tab.slug === activeTabSlug;
          const tabStore = windowDataStore[tab.slug] ?? {};
          const hasData = Object.values(tabStore).some((v) => v && v.trim().length > 0);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSwitchTab(tab.slug)}
              className="px-4 py-2 text-xs font-bold cursor-pointer shrink-0 transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: isActive ? '#ffffff' : '#e2e8f0',
                color: isActive ? '#2563eb' : '#475569',
                borderTop: isActive ? '2px solid #2563eb' : '2px solid transparent',
              }}
              title={
                configs[tab.slug]
                  ? `${tab.title} (synced with GUI1)`
                  : `${tab.title} (synced with GUI1 — using dynamic starter schema)`
              }
            >
              <span>{tab.title}</span>
              {hasData && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#16a34a' }}
                  title="Contains synced data"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── MAIN CONTAINER ── */}
      <div className="flex-1 min-h-0 p-3 overflow-hidden">
          {/* Split-Screen Layout: Left Selectors + Right Windows Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full min-h-0">
            {/* ── LEFT PANE: Dynamic JSON Selector Details ── */}
            <div className="lg:col-span-5 relative flex flex-col gap-2 min-h-0 overflow-hidden">
              <OverlayLayer
                id="gui2_params"
                enabled={overlayMode}
                item={overlaysMap.gui2_params}
                fallbackTitle="GUI2 Parameter Selectors"
                onEdit={onEditOverlay}
                align="center"
              />
              {/* Header Card */}
              <div
                className="p-3 border shrink-0"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold" style={{ color: '#0f172a' }}>
                    ⚙ {activeCfg.tab_title} Parameters
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isUsingStarterSchema && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onCreateStarterConfig(activeTabSlug, activeCfg);
                          showToast(`➕ Saved config/${activeTabSlug}.json`);
                        }}
                        className="px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:bg-blue-100"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                        title={`Save starter schema to config/${activeTabSlug}.json`}
                      >
                        💾 Save Starter Config
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenConfigEditor(activeTabSlug)}
                      className="px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:bg-blue-100"
                      style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      title="Open JSON Creator Studio, Snippet Library & Main Config JSON"
                    >
                      🧩 JSON Studio &amp; Snippets
                    </button>
                  </div>
                </div>
                {activeCfg.description && (
                  <div className="text-xs mt-1" style={{ color: '#475569' }}>
                    {activeCfg.description}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-semibold" style={{ color: '#0f766e' }}>
                    ☑ Included in JSON: {includedFieldIds.length} / {uniqueFields.length} items
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAllFieldsIncluded(true)}
                      className="px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:bg-emerald-100"
                      style={{ backgroundColor: '#ecfdf5', color: '#047857' }}
                      title="Tick all items to include in generated JSON"
                    >
                      ✓ Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllFieldsIncluded(false)}
                      className="px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:bg-slate-200"
                      style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
                      title="Untick all items to exclude from generated JSON"
                    >
                      ☐ Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Fields Card */}
              <div
                className="flex-1 overflow-y-auto p-3 border space-y-4"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
              >
                {uniqueFields.map((field) => {
                  const isIncluded =
                    (includedFieldsByTab[activeTabSlug] ?? {})[field.id] !== false;
                  return (
                    <div
                      key={field.id}
                      className={`pb-3 border-b border-slate-100 last:border-b-0 transition-opacity ${
                        isIncluded ? '' : 'opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => toggleFieldIncluded(field.id)}
                            className="accent-[#16a34a] cursor-pointer w-3.5 h-3.5 shrink-0"
                            title={
                              isIncluded
                                ? `Included in generated JSON — uncheck to exclude '${field.label}'`
                                : `Excluded from generated JSON — check to include '${field.label}'`
                            }
                          />
                          <span
                            onClick={() => toggleFieldIncluded(field.id)}
                            className={`text-xs font-bold cursor-pointer select-none ${
                              isIncluded ? '' : 'line-through'
                            }`}
                            style={{ color: isIncluded ? '#0f172a' : '#64748b' }}
                            title="Click to toggle include/exclude in generated JSON"
                          >
                            {field.label}
                          </span>
                          {!isIncluded && (
                            <span
                              className="px-1.5 py-0.2 text-[10px] font-bold"
                              style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                            >
                              Excluded
                            </span>
                          )}
                          {field.help && (
                            <span
                              className="text-[11px] italic"
                              style={{ color: '#94a3b8' }}
                            >
                              ({field.help})
                            </span>
                          )}
                        </div>

                        {field.type === 'checkbox_group' && (
                          <button
                            type="button"
                            onClick={() => handleOpenConfigEditor(activeTabSlug)}
                            className="px-2 py-0.5 text-[11px] font-bold cursor-pointer shrink-0 hover:bg-blue-100"
                            style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                          >
                            📄 View Config JSON
                          </button>
                        )}
                      </div>

                      <div className={isIncluded ? '' : 'opacity-50 pointer-events-none'}>
                        {field.type === 'checkbox_group' && (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                            {(field.options ?? []).map((opt) => {
                              const selectedArr = Array.isArray(
                                currentFieldVals[field.id]
                              )
                                ? (currentFieldVals[field.id] as string[])
                                : [];
                              const checked = selectedArr.includes(opt);
                              return (
                                <label
                                  key={opt}
                                  className="flex items-center gap-2 text-xs cursor-pointer"
                                  style={{ color: '#0f172a' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!isIncluded}
                                    onChange={() =>
                                      toggleCheckboxOption(field.id, opt)
                                    }
                                    className="accent-[#2563eb] cursor-pointer"
                                  />
                                  <span className="font-mono text-[11px] truncate">
                                    {opt}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {field.type === 'number' && (
                          <input
                            type="number"
                            disabled={!isIncluded}
                            min={field.min ?? 1}
                            max={field.max ?? 1000}
                            value={Number(currentFieldVals[field.id] ?? field.default ?? 1)}
                            onChange={(e) =>
                              updateFieldValue(field.id, Number(e.target.value))
                            }
                            className="w-32 px-2.5 py-1 text-xs border bg-white disabled:bg-slate-100"
                            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
                          />
                        )}

                        {field.type === 'select' && (
                          <select
                            disabled={!isIncluded}
                            value={String(
                              currentFieldVals[field.id] ??
                                field.default ??
                                field.options?.[0] ??
                                ''
                            )}
                            onChange={(e) =>
                              updateFieldValue(field.id, e.target.value)
                            }
                            className="w-full max-w-xs px-2.5 py-1 text-xs border bg-white disabled:bg-slate-100"
                            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
                          >
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            disabled={!isIncluded}
                            value={String(
                              currentFieldVals[field.id] ?? field.default ?? ''
                            )}
                            onChange={(e) =>
                              updateFieldValue(field.id, e.target.value)
                            }
                            className="w-full max-w-sm px-2.5 py-1 text-xs border bg-white disabled:bg-slate-100"
                            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT PANE: Scrollable Windows Canvas (window1..window7) ── */}
            <div className="lg:col-span-7 flex flex-col gap-2 min-h-0 overflow-hidden">
              {/* Right Header */}
              <div
                className="relative flex flex-wrap items-center justify-between gap-2 p-3 border shrink-0"
                style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
              >
                <OverlayLayer
                  id="gui2_canvas_header"
                  enabled={overlayMode}
                  item={overlaysMap.gui2_canvas_header}
                  fallbackTitle="GUI2 Canvas Controls"
                  onEdit={onEditOverlay}
                />
                <div>
                  <div className="text-sm font-bold" style={{ color: '#0f172a' }}>
                    🗂 Windows Canvas
                  </div>
                  <div className="text-xs" style={{ color: '#2563eb' }}>
                    Active Target: window{selectedWindowId} (Click any window card to
                    select)
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handlePopulateWindow(selectedWindowId);
                      showToast(`⚡ Generated JSON for window${selectedWindowId}`);
                    }}
                    className="px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-100"
                    style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                  >
                    ⚡ Gen window{selectedWindowId}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handlePopulateAllWindows();
                      showToast(
                        `⚡ Populated all ${totalWindows} windows`
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-200"
                    style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                  >
                    ⚡ Gen ALL Windows (1-{totalWindows})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllWindows(activeTabSlug);
                      showToast(`🗑 Cleared all ${totalWindows} windows`);
                    }}
                    className="px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-red-100"
                    style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                  >
                    🗑 Clear All Windows
                  </button>
                </div>
              </div>

              {/* Window Cards (synced with GUI1 window count) */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <OverlayLayer
                  id="gui2_window_cards"
                  enabled={overlayMode}
                  item={overlaysMap.gui2_window_cards}
                  fallbackTitle={`GUI2 Window Cards (1-${totalWindows})`}
                  onEdit={onEditOverlay}
                  align="center"
                />
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {Array.from(
                  { length: totalWindows },
                  (_, idx) => idx + 1
                ).map((wId) => {
                  const isTarget = wId === selectedWindowId;
                  const existingVal = windowDataStore[activeTabSlug]?.[wId] ?? '';
                  const inlineKey = `${activeTabSlug}:${wId}`;
                  const isInlineOriginal = Boolean(inlineOriginalByWin[inlineKey]);
                  const inlineOriginalText = isInlineOriginal
                    ? formatWindowOriginalForm(existingVal, wId, selectedTabName).text
                    : '';
                  return (
                    <div
                      key={wId}
                      ref={(el) => {
                        windowCardRefs.current[wId] = el;
                      }}
                      onClick={() => onSelectTargetWindow(wId)}
                      className="p-3 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isTarget ? '#eff6ff' : '#ffffff',
                        border: isTarget
                          ? '2px solid #2563eb'
                          : '1px solid #e2e8f0',
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTargetWindow(wId);
                            }}
                            className="text-xs font-bold cursor-pointer"
                            style={{ color: isTarget ? '#2563eb' : '#0f172a' }}
                          >
                            ✦ Window {wId} (window{wId})
                          </button>
                          {isTarget && (
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: '#2563eb' }}
                            >
                              [ 🎯 ACTIVE TARGET ]
                            </span>
                          )}
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTargetWindow(wId);
                              setOriginalFormModal({ activeTab: wId });
                            }}
                            className="px-2 py-1 text-[11px] cursor-pointer hover:brightness-95"
                            style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
                          >
                            📊 Original Form
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTargetWindow(wId);
                              setInlineOriginalByWin((prev) => ({
                                ...prev,
                                [inlineKey]: !prev[inlineKey],
                              }));
                            }}
                            className="px-2 py-1 text-[11px] font-bold cursor-pointer hover:brightness-95"
                            style={{
                              backgroundColor: isInlineOriginal ? '#1d4ed8' : '#fef3c7',
                              color: isInlineOriginal ? '#ffffff' : '#92400e',
                            }}
                            title={
                              isInlineOriginal
                                ? 'Switch back to editable JSON view in this window'
                                : 'Show Original Form inside this same window'
                            }
                          >
                            {isInlineOriginal ? '🔁 JSON View' : '🔁 Original View'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const textToCopy = isInlineOriginal
                                ? inlineOriginalText
                                : existingVal;
                              if (!textToCopy.trim()) {
                                showToast(`⚠️ window${wId} has no data to copy`, true);
                                return;
                              }
                              await copyToClipboard(textToCopy);
                              triggerCopyBlink(inlineKey);
                              showToast(`✓ Copied window${wId} data`);
                            }}
                            className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                              copiedWinKey === inlineKey
                                ? 'copy-btn-blink'
                                : 'hover:bg-slate-200'
                            }`}
                            style={
                              copiedWinKey === inlineKey
                                ? undefined
                                : { backgroundColor: '#f1f5f9', color: '#475569' }
                            }
                            title={`Copy window${wId} contents`}
                          >
                            {copiedWinKey === inlineKey ? '✓ Copied!' : '📋 Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTargetWindow(wId);
                              handlePopulateWindow(wId);
                              showToast(`⚡ Generated JSON for window${wId}`);
                            }}
                            className="px-2 py-1 text-[11px] font-bold cursor-pointer hover:bg-blue-100"
                            style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                          >
                            ⚡ Gen JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectTargetWindow(wId)}
                            className="px-2 py-1 text-[11px] font-bold cursor-pointer hover:bg-slate-200"
                            style={{
                              backgroundColor: isTarget ? '#2563eb' : '#f1f5f9',
                              color: isTarget ? '#ffffff' : '#0f172a',
                            }}
                            title={`Select window${wId} as the Active Target for Gen windowN, Live Preview, and Send`}
                          >
                            🎯 {isTarget ? 'Target' : 'Set Target'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              onSelectTargetWindow(wId);
                              await sendValidatedWindow(wId);
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-white cursor-pointer hover:opacity-95"
                            style={{ backgroundColor: '#16a34a' }}
                            title={`Send valid inputted data from window${wId} to GUI1`}
                          >
                            💾 Send
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateWindowData(activeTabSlug, wId, '');
                              showToast(`🗑 Cleared window${wId}`);
                            }}
                            className="px-2 py-1 text-[11px] font-bold cursor-pointer hover:bg-red-100"
                            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                            title={`Clear window${wId}`}
                          >
                            🗑 Clear
                          </button>
                        </div>
                      </div>

                      {isInlineOriginal ? (
                        <textarea
                          readOnly
                          value={inlineOriginalText}
                          onFocus={() => onSelectTargetWindow(wId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTargetWindow(wId);
                          }}
                          rows={6}
                          spellCheck={false}
                          className="w-full p-2 text-[11px] border focus:outline-none select-text"
                          style={{
                            backgroundColor: '#fffbeb',
                            borderColor: '#fcd34d',
                            color: '#0f172a',
                            fontFamily: "'Consolas', 'Courier New', monospace",
                          }}
                        />
                      ) : (
                        <textarea
                          value={existingVal}
                          onFocus={() => onSelectTargetWindow(wId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTargetWindow(wId);
                          }}
                          onChange={(e) =>
                            onUpdateWindowData(activeTabSlug, wId, e.target.value)
                          }
                          placeholder={`// window${wId} JSON data — Click '⚡ Gen JSON' or 'Set Target' to generate.`}
                          rows={6}
                          spellCheck={false}
                          className="w-full p-2 text-[11px] border focus:outline-none focus:border-[#2563eb] cursor-text"
                          style={{
                            backgroundColor: '#f8fafc',
                            borderColor: '#cbd5e1',
                            color: '#0f172a',
                            fontFamily: "'Consolas', 'Courier New', monospace",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* ── BOTTOM ACTION BAR (#ffffff) ── */}
      <div
        className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t"
        style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
      >
        <OverlayLayer
          id="gui2_bottom_bar"
          enabled={overlayMode}
          item={overlaysMap.gui2_bottom_bar}
          fallbackTitle="GUI2 Bottom Dispatch Bar"
          onEdit={onEditOverlay}
        />
        <div
          className="text-xs truncate max-w-xl font-semibold"
          style={{ color: toastIsError ? '#dc2626' : statusColor }}
        >
          {toastMsg || statusText}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!activeCfg}
            onClick={() => setLivePreviewOpen(true)}
            className="px-3.5 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
          >
            🔍 Live JSON Preview (Pop-up)
          </button>
          <button
            type="button"
            disabled={!activeCfg}
            onClick={async () => {
              await sendValidatedWindow(selectedWindowId);
            }}
            className="px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50 hover:opacity-95"
            style={{ backgroundColor: '#16a34a' }}
            title={`Send valid inputted data from window${selectedWindowId} to GUI1`}
          >
            💾 Send to window{selectedWindowId}
          </button>
          <button
            type="button"
            disabled={!activeCfg}
            onClick={async () => {
              const batch = handlePopulateAllWindows();
              await onSendAllWindows(activeTabSlug, batch);
            }}
            className="px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50 hover:opacity-95"
            style={{ backgroundColor: '#0284c7' }}
          >
            ⚡ Send ALL Windows (1-{totalWindows})
          </button>
        </div>
      </div>

      {/* ── LIVE JSON PREVIEW POP-UP MODAL ── */}
      {livePreviewOpen && (
        <div
          onClick={() => setLivePreviewOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col p-4"
            style={{ borderColor: '#cbd5e1' }}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  🔍 Live JSON Preview — [{activeTabSlug.toUpperCase()}] (Target:
                  window{selectedWindowId})
                </h3>
                <p className="text-xs text-slate-500">
                  Live JSON Output for window{selectedWindowId} (
                  {livePreviewPayload?.data.length ?? 0} records)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(livePreviewStr);
                    showToast('📋 JSON preview copied to clipboard!');
                  }}
                  className="px-3 py-1.5 text-xs font-bold cursor-pointer"
                  style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                >
                  📋 Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => setLivePreviewOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  Close
                </button>
              </div>
            </div>
            <pre
              className="flex-1 overflow-auto mt-3 p-3 border text-xs select-text"
              style={{
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                fontFamily: "'Consolas', 'Courier New', monospace",
              }}
            >
              {livePreviewStr}
            </pre>
          </div>
        </div>
      )}

      {/* ── ORIGINAL FORM MULTI-WINDOW TABBED MODAL ── */}
      {originalFormModal && (() => {
        const allWinEntries = Array.from(
          { length: totalWindows },
          (_, idx) => {
            const wid = idx + 1;
            return {
              windowId: wid,
              content: windowDataStore[activeTabSlug]?.[wid] ?? '',
            };
          }
        );
        const allCombinedText = formatAllWindowsOriginalForm(
          allWinEntries,
          selectedTabName
        );
        const currentTab = originalFormModal.activeTab;
        const currentViewText =
          currentTab === 'all'
            ? allCombinedText
            : formatWindowOriginalForm(
                windowDataStore[activeTabSlug]?.[currentTab] ?? '',
                currentTab,
                selectedTabName
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
              style={{ borderColor: '#cbd5e1' }}
            >
              {/* Popup Header + Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    📊 Original Form — {selectedTabName}{' '}
                    {currentTab === 'all'
                      ? `/ All Windows (1-${totalWindows})`
                      : `/ window${currentTab}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {currentTab === 'all'
                      ? `Combined tabular view across all ${totalWindows} windows (${populatedCount}/${totalWindows} populated)`
                      : `Codebase tabular view of window${currentTab} (${populatedCount}/${totalWindows} populated across tab)`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {currentTab !== 'all' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTargetWindow(currentTab);
                          showToast(`🎯 Set window${currentTab} as active target`);
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-200"
                        style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                      >
                        🎯 Set Target
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handlePopulateWindow(currentTab);
                          showToast(`⚡ Generated JSON for window${currentTab}`);
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-100"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        ⚡ Gen window{currentTab}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handlePopulateAllWindows();
                      showToast(`⚡ Generated JSON for all ${totalWindows} windows`);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-blue-100"
                    style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                  >
                    ⚡ Gen ALL (1-{totalWindows})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentViewText);
                      showToast('📋 Current view copied to clipboard!');
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-200"
                    style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                  >
                    📋 Copy View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(allCombinedText);
                      showToast(`📋 All ${totalWindows} windows copied to clipboard!`);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-200"
                    style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
                  >
                    📋 Copy All (1-{totalWindows})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackName = `${activeTabSlug}_${
                        currentTab === 'all' ? 'all_windows' : `window${currentTab}`
                      }_original_form.txt`;
                      setDownloadTxtModal({
                        dir: defaultDownloadDir || 'workspace',
                        fileName: defaultDownloadFileName || fallbackName,
                        content: currentViewText,
                        error: null,
                        saving: false,
                      });
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    ⬇ Download .txt
                  </button>
                  <button
                    type="button"
                    onClick={() => setOriginalFormModal(null)}
                    className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Multi-Window Tab Strip */}
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
                    color: currentTab === 'all' ? '#2563eb' : '#475569',
                    borderTopColor: currentTab === 'all' ? '#2563eb' : 'transparent',
                  }}
                >
                  🗂 All Windows (1-{totalWindows})
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
                        color: isActive ? '#2563eb' : '#475569',
                        borderTopColor: isActive ? '#2563eb' : 'transparent',
                      }}
                    >
                      <span>Window {windowId}</span>
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: hasData ? '#16a34a' : '#94a3b8',
                        }}
                        title={hasData ? 'Populated' : 'Empty'}
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
                  borderColor: '#cbd5e1',
                  fontFamily: "'Consolas', 'Courier New', monospace",
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* ── EDITABLE CONFIG JSON + JSON CREATOR STUDIO & SNIPPET LIBRARY MODAL ── */}
      {configEditorModal && (
        <JsonCreatorStudioModal
          tabSlug={configEditorModal.tabSlug}
          rawJson={configEditorModal.rawJson}
          error={configEditorModal.error}
          onChangeRawJson={(nextJson) =>
            setConfigEditorModal({
              ...configEditorModal,
              rawJson: nextJson,
              error: null,
            })
          }
          onSaveConfig={handleSaveConfigEditor}
          onClose={() => setConfigEditorModal(null)}
          onNotify={(msg) => showToast(msg)}
        />
      )}

      {/* ── GENERATION HISTORY MODAL ── */}
      {historyModalOpen && (
        <div
          onClick={() => setHistoryModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col p-4"
            style={{ borderColor: '#cbd5e1' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                📜 Output Generation History (output/generation_history.jsonl)
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-3 py-1 text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: '#2563eb' }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mt-3 divide-y divide-slate-200">
              {history.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No outputs generated yet. Click &quot;Send to windowX&quot; or
                  &quot;Send ALL Windows&quot; to record outputs.
                </div>
              ) : (
                history.map((entry, idx) => (
                  <div
                    key={`${entry.file}-${idx}`}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900 truncate">
                        {entry.file}
                      </div>
                      <div className="text-slate-500">
                        Tab: {entry.tab} • Window: {entry.window} • Records:{' '}
                        {entry.records} • {entry.timestamp.slice(0, 19)}
                      </div>
                    </div>
                    {entry.json_preview && (
                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([entry.json_preview!], {
                            type: 'application/json',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = entry.file;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold shrink-0 cursor-pointer"
                        style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                      >
                        ⬇ Download
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DOWNLOAD .TXT SAVE LOCATION & FILE NAME MODAL ── */}
      {downloadTxtModal && (() => {
        const submitDownload = async (alsoDownloadBrowser: boolean) => {
          if (!downloadTxtModal.dir.trim() || !downloadTxtModal.fileName.trim()) {
            setDownloadTxtModal({
              ...downloadTxtModal,
              error: 'Please enter both a save location and a file name.',
            });
            return;
          }
          setDownloadTxtModal((prev) => (prev ? { ...prev, saving: true, error: null } : null));
          try {
            await onDownloadTxtWithLocation(
              downloadTxtModal.dir,
              downloadTxtModal.fileName,
              downloadTxtModal.content,
              alsoDownloadBrowser
            );
            const rawName = downloadTxtModal.fileName.trim();
            const cleanName = rawName.includes('.') ? rawName : `${rawName}.txt`;
            showToast(`✅ Saved ${cleanName} to ${downloadTxtModal.dir.trim()}`);
            setDownloadTxtModal(null);
          } catch (err) {
            setDownloadTxtModal((prev) =>
              prev ? { ...prev, saving: false, error: String(err) } : null
            );
          }
        };

        const previewDir = downloadTxtModal.dir.trim() || 'workspace';
        const previewRawName = downloadTxtModal.fileName.trim() || 'original_form.txt';
        const previewFileName = previewRawName.includes('.')
          ? previewRawName
          : `${previewRawName}.txt`;

        return (
          <div
            onClick={() => {
              if (!downloadTxtModal.saving) setDownloadTxtModal(null);
            }}
            className="fixed inset-0 z-[60] bg-slate-900/45 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white border shadow-2xl w-full max-w-md p-5"
              style={{ borderColor: '#cbd5e1' }}
            >
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                ⬇ Save &amp; Download Original Form (.txt)
              </h3>

              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Save location (directory):
              </label>
              <input
                type="text"
                autoFocus
                value={downloadTxtModal.dir}
                onChange={(e) =>
                  setDownloadTxtModal({
                    ...downloadTxtModal,
                    dir: e.target.value,
                    error: null,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !downloadTxtModal.saving) {
                    void submitDownload(true);
                  }
                }}
                placeholder="workspace"
                className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-3 font-mono"
              />

              <label className="block text-xs font-semibold text-slate-600 mb-1">
                File name:
              </label>
              <input
                type="text"
                value={downloadTxtModal.fileName}
                onChange={(e) =>
                  setDownloadTxtModal({
                    ...downloadTxtModal,
                    fileName: e.target.value,
                    error: null,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !downloadTxtModal.saving) {
                    void submitDownload(true);
                  }
                }}
                placeholder="original_form.txt"
                className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-2 font-mono"
              />

              <p className="text-[11px] text-slate-500 mb-3 font-mono break-all">
                Target: saved_projects/{previewDir}/{previewFileName}
              </p>

              {downloadTxtModal.error && (
                <p className="text-xs text-red-600 font-semibold mb-3">
                  {downloadTxtModal.error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={downloadTxtModal.saving}
                  onClick={() => setDownloadTxtModal(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={downloadTxtModal.saving}
                  onClick={() => void submitDownload(false)}
                  className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#0f766e' }}
                >
                  {downloadTxtModal.saving ? 'Saving...' : 'Save to Location'}
                </button>
                <button
                  type="button"
                  disabled={downloadTxtModal.saving}
                  onClick={() => void submitDownload(true)}
                  className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {downloadTxtModal.saving ? 'Saving...' : 'Save & Download .txt'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── GUI2 TEXT-FILE HELP MODAL ── */}
      {helpOpen && (
        <TextHelpModal
          docId="gui2"
          title="❓ GUI2 Help — Dynamic JSON Generator & Window Canvas"
          accentColor="#2563eb"
          defaultText={DEFAULT_GUI2_HELP_TXT}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
};
