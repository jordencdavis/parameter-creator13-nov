import React, { useEffect, useState } from 'react';
import type { OverlayItem } from '../utils/helpContent';
import { parseHelpSections } from '../utils/helpContent';

interface OverlayLayerProps {
  id: string;
  enabled: boolean;
  item?: OverlayItem;
  fallbackTitle: string;
  fallbackDescription?: string;
  onEdit: (id: string) => void;
  align?: 'top-right' | 'top-left' | 'bottom-right' | 'center';
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  id,
  enabled,
  item,
  fallbackTitle,
  fallbackDescription = 'Click to add helper description for this component.',
  onEdit,
  align = 'top-right',
}) => {
  if (!enabled) return null;

  const title = item?.title || fallbackTitle;
  const description = item?.description || fallbackDescription;

  const alignCls =
    align === 'top-left'
      ? 'items-start justify-start'
      : align === 'bottom-right'
        ? 'items-end justify-end'
        : align === 'center'
          ? 'items-center justify-center'
          : 'items-start justify-end';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onEdit(id);
        }
      }}
      title={`Click to edit overlay for ${title}`}
      className={`absolute inset-0 z-30 flex ${alignCls} p-1.5 border-2 border-dashed border-amber-400 bg-slate-900/20 hover:bg-slate-900/35 cursor-pointer transition-colors`}
    >
      <div
        className="max-w-sm border border-amber-400 shadow-lg px-2.5 py-1.5 text-left pointer-events-none"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-amber-300 truncate">
            🏷 {title}
          </span>
          <span className="text-[10px] font-semibold text-emerald-300 shrink-0">
            ✎ Click to edit
          </span>
        </div>
        <p className="text-[11px] text-slate-100 leading-snug mt-0.5 whitespace-pre-wrap">
          {description}
        </p>
      </div>
    </div>
  );
};

interface OverlayEditModalProps {
  componentId: string;
  item: OverlayItem;
  defaultItem?: OverlayItem;
  onSave: (componentId: string, updated: OverlayItem) => Promise<void>;
  onClose: () => void;
}

export const OverlayEditModal: React.FC<OverlayEditModalProps> = ({
  componentId,
  item,
  defaultItem,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-300 shadow-2xl w-full max-w-lg p-5"
        style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}
      >
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              🏷 Edit Component Overlay Description
            </h3>
            <p className="text-[11px] font-mono text-slate-500">
              [{componentId}] • Saved to help/component_overlays.txt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Component Title:
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          className="w-full border border-slate-300 px-3 py-1.5 text-sm mb-3 text-slate-900"
        />

        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Overlay Helper Description:
        </label>
        <textarea
          rows={5}
          autoFocus
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(null);
          }}
          className="w-full border border-slate-300 px-3 py-2 text-xs text-slate-900 mb-3 resize-y"
        />

        {error && (
          <p className="text-xs font-semibold text-red-600 mb-3">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {defaultItem && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setTitle(defaultItem.title);
                  setDescription(defaultItem.description);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200"
              >
                Reset Default
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!title.trim() || !description.trim()) {
                  setError('Please enter both a title and description.');
                  return;
                }
                setSaving(true);
                try {
                  await onSave(componentId, {
                    title: title.trim(),
                    description: description.trim(),
                  });
                  onClose();
                } catch (err) {
                  setError(String(err));
                } finally {
                  setSaving(false);
                }
              }}
              className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: '#16a34a' }}
            >
              {saving ? 'Saving...' : '💾 Save Overlay (.txt)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TextHelpModalProps {
  docId: 'gui1' | 'gui2';
  title: string;
  accentColor: string;
  defaultText: string;
  onClose: () => void;
}

export const TextHelpModal: React.FC<TextHelpModalProps> = ({
  docId,
  title,
  accentColor,
  defaultText,
  onClose,
}) => {
  const [rawText, setRawText] = useState<string>(defaultText);
  const [draftText, setDraftText] = useState<string>(defaultText);
  const [fileName, setFileName] = useState<string>(`help/${docId}_help.txt`);
  const [viewMode, setViewMode] = useState<'formatted' | 'edit'>('formatted');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFromFile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/help/${docId}`);
      if (res.ok) {
        const data = (await res.json()) as { fileName?: string; content?: string };
        if (typeof data.content === 'string') {
          setRawText(data.content);
          setDraftText(data.content);
        }
        if (data.fileName) {
          setFileName(data.fileName);
        }
      }
    } catch {
      // keep default/existing text if fetch fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFromFile();
  }, [docId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSaveTxt = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/help/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftText }),
      });
      if (!res.ok) {
        throw new Error(`Failed to save (${res.status})`);
      }
      setRawText(draftText);
      setViewMode('formatted');
      setNotice(`✅ Saved ${fileName}`);
    } catch (err) {
      setNotice(`⚠ ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const sections = parseHelpSections(rawText);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border shadow-2xl w-full max-w-3xl h-[82vh] flex flex-col p-5"
        style={{
          borderColor: '#cbd5e1',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs font-mono text-slate-500">
              📄 Source: {fileName} {loading ? '(loading...)' : ''}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode('formatted')}
              className="px-2.5 py-1 text-xs font-bold cursor-pointer border"
              style={{
                backgroundColor: viewMode === 'formatted' ? accentColor : '#f8fafc',
                borderColor: viewMode === 'formatted' ? accentColor : '#cbd5e1',
                color: viewMode === 'formatted' ? '#ffffff' : '#334155',
              }}
            >
              📖 Formatted Help
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftText(rawText);
                setViewMode('edit');
              }}
              className="px-2.5 py-1 text-xs font-bold cursor-pointer border"
              style={{
                backgroundColor: viewMode === 'edit' ? accentColor : '#f8fafc',
                borderColor: viewMode === 'edit' ? accentColor : '#cbd5e1',
                color: viewMode === 'edit' ? '#ffffff' : '#334155',
              }}
            >
              📝 Edit .txt File
            </button>
            <button
              type="button"
              onClick={() => void loadFromFile()}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer hover:bg-slate-200"
              title="Reload text file from disk"
            >
              🔄 Reload .txt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              Close
            </button>
          </div>
        </div>

        {notice && (
          <div className="mt-2 px-3 py-1.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
            {notice}
          </div>
        )}

        {viewMode === 'formatted' ? (
          <div className="flex-1 overflow-y-auto mt-3 space-y-4 text-xs text-slate-700 pr-1">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="font-bold text-slate-900 mb-1.5">{sec.title}</div>
                <ul className="border border-slate-200 divide-y divide-slate-200 bg-white">
                  {sec.items.map((item, idx) => (
                    <li key={`${sec.title}-${idx}`} className="p-2.5 leading-relaxed">
                      {item.label ? (
                        <>
                          <span className="font-bold text-slate-900">
                            {item.label}:
                          </span>{' '}
                          <span>{item.text}</span>
                        </>
                      ) : (
                        <span>{item.text}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 mt-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-3 border border-slate-300 text-xs resize-none focus:outline-none focus:border-blue-600"
              style={{
                backgroundColor: '#f8fafc',
                fontFamily: "'Consolas', 'Courier New', monospace",
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setDraftText(rawText);
                  setViewMode('formatted');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveTxt()}
                className="px-3 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#16a34a' }}
              >
                {saving ? 'Saving...' : `💾 Save ${fileName}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
