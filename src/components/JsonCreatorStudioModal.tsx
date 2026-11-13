import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BUILTIN_JSON_SNIPPETS } from '../data/jsonSnippets';
import type { ConfigFieldType, JsonSnippet, JsonSnippetKind } from '../types/app';

const LOCAL_SNIPPETS_KEY = 'notetool_custom_json_snippets_v1';

interface KvRow {
  id: string;
  key: string;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'json';
  rawValue: string;
}

interface JsonCreatorStudioModalProps {
  tabSlug: string;
  rawJson: string;
  error: string | null;
  onChangeRawJson: (nextJson: string) => void;
  onSaveConfig: () => Promise<void>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

function makeDefaultKvRows(): KvRow[] {
  return [
    { id: 'r1', key: 'protocol', valueType: 'string', rawValue: 'Modbus_TCP' },
    { id: 'r2', key: 'host', valueType: 'string', rawValue: '192.168.1.50' },
    { id: 'r3', key: 'port', valueType: 'number', rawValue: '502' },
    { id: 'r4', key: 'unit_id', valueType: 'number', rawValue: '1' },
    { id: 'r5', key: 'polling_ms', valueType: 'number', rawValue: '250' },
    { id: 'r6', key: 'enabled', valueType: 'boolean', rawValue: 'true' },
    {
      id: 'r7',
      key: 'registers',
      valueType: 'array',
      rawValue: '40001, 40002, 40003',
    },
  ];
}

function formatPlainValue(val: unknown, indent = 2): string[] {
  const pad = ' '.repeat(indent);
  if (val === null || val === undefined) {
    return [`${pad}(none)`];
  }
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return [`${pad}${String(val)}`];
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return [`${pad}(empty list)`];
    const allPrimitives = val.every(
      (item) => item === null || (typeof item !== 'object' && !Array.isArray(item))
    );
    if (allPrimitives) {
      return val.map((item, idx) => `${pad}${idx + 1}. ${String(item ?? '')}`);
    }
    const out: string[] = [];
    val.forEach((item, idx) => {
      out.push(`${pad}[Item ${idx + 1}]`);
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (v !== null && typeof v === 'object') {
            out.push(`${pad}  ${k.toUpperCase()} :`);
            out.push(...formatPlainValue(v, indent + 4));
          } else {
            out.push(`${pad}  ${k.padEnd(20)} : ${String(v ?? '')}`);
          }
        }
      } else {
        out.push(...formatPlainValue(item, indent + 2));
      }
    });
    return out;
  }
  const obj = val as Record<string, unknown>;
  const entries = Object.entries(obj);
  if (entries.length === 0) return [`${pad}(empty)`];
  const out: string[] = [];
  for (const [k, v] of entries) {
    if (v !== null && typeof v === 'object') {
      out.push(`${pad}${k.toUpperCase()} :`);
      out.push(...formatPlainValue(v, indent + 2));
    } else {
      out.push(`${pad}${k.padEnd(22)} : ${String(v ?? '')}`);
    }
  }
  return out;
}

function formatMainConfigOriginalLayout(rawJson: string, tabSlug: string): string {
  const sep = '═'.repeat(74);
  const subSep = '─'.repeat(74);
  const trimmed = rawJson.trim();

  if (!trimmed) {
    return [
      sep,
      `  MAIN CONFIG ORIGINAL LAYOUT  •  config/${tabSlug}.json`,
      sep,
      '  (empty config)',
      sep,
    ].join('\n');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return [
      sep,
      `  MAIN CONFIG ORIGINAL LAYOUT  •  config/${tabSlug}.json`,
      `  ⚠ JSON Parse Notice: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      sep,
      trimmed,
      sep,
    ].join('\n');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [
      sep,
      `  MAIN CONFIG ORIGINAL LAYOUT  •  config/${tabSlug}.json`,
      sep,
      ...formatPlainValue(parsed, 2),
      sep,
    ].join('\n');
  }

  const record = parsed as Record<string, unknown>;
  const lines: string[] = [
    sep,
    `  MAIN CONFIG ORIGINAL LAYOUT  •  FILE: config/${tabSlug}.json`,
    sep,
  ];

  const metaKeys = ['tab_id', 'tab_title', 'version', 'generator_type', 'description'];
  const hasMeta = metaKeys.some((k) => record[k] !== undefined);
  if (hasMeta) {
    if (record.tab_id !== undefined) {
      lines.push(`  TAB ID          : ${String(record.tab_id)}`);
    }
    if (record.tab_title !== undefined) {
      lines.push(`  TAB TITLE       : ${String(record.tab_title)}`);
    }
    if (record.version !== undefined) {
      lines.push(`  VERSION         : ${String(record.version)}`);
    }
    if (record.generator_type !== undefined) {
      lines.push(`  GENERATOR TYPE  : ${String(record.generator_type)}`);
    }
    if (record.description !== undefined) {
      lines.push(`  DESCRIPTION     : ${String(record.description)}`);
    }
    lines.push(subSep);
  }

  if (Array.isArray(record.fields)) {
    const fields = record.fields as Array<Record<string, unknown>>;
    lines.push(`  FORM FIELDS (${fields.length})`);
    lines.push(subSep);
    if (fields.length === 0) {
      lines.push('  (no fields configured)');
    } else {
      fields.forEach((f, idx) => {
        const id = String(f?.id ?? `field_${idx + 1}`);
        const label = String(f?.label ?? id);
        const type = String(f?.type ?? 'text');
        const defVal = Array.isArray(f?.default)
          ? f.default.map(String).join(', ')
          : f?.default !== undefined
            ? String(f.default)
            : '(none)';
        lines.push(`  [${idx + 1}] ${label}  (${id})`);
        lines.push(`      Type     : ${type}`);
        lines.push(`      Default  : ${defVal}`);
        if (Array.isArray(f?.options) && f.options.length > 0) {
          lines.push(`      Options  : ${f.options.map(String).join(' | ')}`);
        }
        if (f?.min !== undefined || f?.max !== undefined) {
          lines.push(`      Range    : ${String(f.min ?? '—')} to ${String(f.max ?? '—')}`);
        }
        if (f?.help) {
          lines.push(`      Help     : ${String(f.help)}`);
        }
        const standardFieldKeys = new Set([
          'id',
          'label',
          'type',
          'default',
          'options',
          'min',
          'max',
          'help',
        ]);
        for (const [fk, fv] of Object.entries(f || {})) {
          if (standardFieldKeys.has(fk)) continue;
          if (fv !== null && typeof fv === 'object') {
            lines.push(`      ${fk.padEnd(9)}:`);
            lines.push(...formatPlainValue(fv, 8));
          } else {
            lines.push(`      ${fk.padEnd(9)}: ${String(fv ?? '')}`);
          }
        }
        if (idx < fields.length - 1) {
          lines.push('  ' + '·'.repeat(70));
        }
      });
    }
  }

  const handledTopKeys = new Set([...metaKeys, 'fields']);
  const extraKeys = Object.keys(record).filter((k) => !handledTopKeys.has(k));
  if (extraKeys.length > 0) {
    lines.push('');
    lines.push(subSep);
    lines.push('  ADDITIONAL CONFIGURATION / SNIPPET SECTIONS');
    lines.push(subSep);
    for (const key of extraKeys) {
      const val = record[key];
      if (val !== null && typeof val === 'object') {
        lines.push(`  ▸ ${key.toUpperCase()}`);
        lines.push(...formatPlainValue(val, 4));
      } else {
        lines.push(`  ${key.padEnd(24)} : ${String(val ?? '')}`);
      }
    }
  }

  lines.push(sep);
  return lines.join('\n');
}

export const JsonCreatorStudioModal: React.FC<JsonCreatorStudioModalProps> = ({
  tabSlug,
  rawJson,
  error,
  onChangeRawJson,
  onSaveConfig,
  onClose,
  onNotify,
}) => {
  const [leftTab, setLeftTab] = useState<'library' | 'studio'>('library');
  const [studioMode, setStudioMode] = useState<'field' | 'custom_json'>('field');

  // Custom saved snippets
  const [customSnippets, setCustomSnippets] = useState<JsonSnippet[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SNIPPETS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as JsonSnippet[];
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(
    BUILTIN_JSON_SNIPPETS[0]?.id ?? null
  );

  // Studio: Config Field Builder
  const [fieldId, setFieldId] = useState('industrial_protocol');
  const [fieldLabel, setFieldLabel] = useState('Industrial Protocol');
  const [fieldType, setFieldType] = useState<ConfigFieldType>('select');
  const [fieldOptionsText, setFieldOptionsText] = useState(
    'Modbus RTU, Modbus TCP, OPC UA, PROFINET, EtherNet/IP, CANopen, MQTT Sparkplug B'
  );
  const [fieldDefault, setFieldDefault] = useState('Modbus TCP');
  const [fieldMin, setFieldMin] = useState(1);
  const [fieldMax, setFieldMax] = useState(500);
  const [fieldHelp, setFieldHelp] = useState('Select industrial protocol standard.');

  // Studio: Custom JSON Key-Value Builder
  const [kvRows, setKvRows] = useState<KvRow[]>(makeDefaultKvRows);

  // Save Snippet Form
  const [saveSnippetTitle, setSaveSnippetTitle] = useState('');
  const [saveSnippetCategory, setSaveSnippetCategory] = useState('Industrial Protocol');
  const [saveSnippetDesc, setSaveSnippetDesc] = useState('');
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);

  // Copy blink tracking
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [studioFeedback, setStudioFeedback] = useState<string | null>(null);
  const [showMainOriginalLayout, setShowMainOriginalLayout] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/snippets');
        if (!res.ok) return;
        const data = (await res.json()) as { snippets?: JsonSnippet[] };
        if (active && Array.isArray(data.snippets) && data.snippets.length > 0) {
          setCustomSnippets(data.snippets);
          try {
            localStorage.setItem(LOCAL_SNIPPETS_KEY, JSON.stringify(data.snippets));
          } catch {
            // ignore
          }
        }
      } catch {
        // keep localStorage fallback
      }
    })();
    return () => {
      active = false;
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const flashFeedback = (msg: string) => {
    setStudioFeedback(msg);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setStudioFeedback(null), 2800);
    onNotify(msg);
  };

  const copyText = async (text: string, blinkKey: string, label: string) => {
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
    setCopiedId(null);
    window.requestAnimationFrame(() => setCopiedId(blinkKey));
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1400);
    flashFeedback(`✓ Copied ${label} — ready to paste into Main Config JSON`);
  };

  const persistCustomSnippets = async (next: JsonSnippet[]) => {
    setCustomSnippets(next);
    try {
      localStorage.setItem(LOCAL_SNIPPETS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    try {
      await fetch('/api/snippets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: next }),
      });
    } catch {
      // offline fallback already persisted locally
    }
  };

  // Live Studio Output
  const studioGeneratedObj = useMemo(() => {
    if (studioMode === 'field') {
      const options = fieldOptionsText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const cleanId =
        fieldId
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'custom_field';

      const out: Record<string, unknown> = {
        id: cleanId,
        label: fieldLabel.trim() || cleanId,
        type: fieldType,
      };
      if (fieldType === 'select' || fieldType === 'checkbox_group') {
        out.options = options;
        if (fieldType === 'checkbox_group') {
          const defaults = fieldDefault
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          out.default = defaults.length > 0 ? defaults : options.slice(0, 3);
        } else {
          out.default = fieldDefault.trim() || options[0] || '';
        }
      } else if (fieldType === 'number') {
        out.min = Number.isFinite(fieldMin) ? fieldMin : 1;
        out.max = Number.isFinite(fieldMax) ? fieldMax : 100;
        const defNum = Number(fieldDefault);
        out.default = Number.isFinite(defNum) ? defNum : out.min;
      } else {
        out.default = fieldDefault;
      }
      if (fieldHelp.trim()) {
        out.help = fieldHelp.trim();
      }
      return out;
    }

    const obj: Record<string, unknown> = {};
    for (const row of kvRows) {
      const k = row.key.trim();
      if (!k) continue;
      if (row.valueType === 'number') {
        const n = Number(row.rawValue);
        obj[k] = Number.isFinite(n) ? n : 0;
      } else if (row.valueType === 'boolean') {
        obj[k] = row.rawValue.trim().toLowerCase() === 'true';
      } else if (row.valueType === 'array') {
        obj[k] = row.rawValue
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (row.valueType === 'json') {
        try {
          obj[k] = JSON.parse(row.rawValue);
        } catch {
          obj[k] = row.rawValue;
        }
      } else {
        obj[k] = row.rawValue;
      }
    }
    return obj;
  }, [
    studioMode,
    fieldId,
    fieldLabel,
    fieldType,
    fieldOptionsText,
    fieldDefault,
    fieldMin,
    fieldMax,
    fieldHelp,
    kvRows,
  ]);

  const studioGeneratedJson = useMemo(
    () => JSON.stringify(studioGeneratedObj, null, 2),
    [studioGeneratedObj]
  );

  // Combined Snippet Library
  const allSnippets = useMemo(
    () => [...customSnippets, ...BUILTIN_JSON_SNIPPETS],
    [customSnippets]
  );

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    for (const s of allSnippets) {
      set.add(s.category);
    }
    if (customSnippets.length > 0) set.add('Custom Saved');
    return Array.from(set);
  }, [allSnippets, customSnippets.length]);

  const filteredSnippets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSnippets.filter((s) => {
      if (selectedCategory === 'Custom Saved') {
        if (!s.custom) return false;
      } else if (selectedCategory !== 'All' && s.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.json.toLowerCase().includes(q)
      );
    });
  }, [allSnippets, selectedCategory, searchQuery]);

  // Main config JSON validity indicator
  const mainConfigValidStatus = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson) as { fields?: unknown[] };
      const fieldCount = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
      return { ok: true, label: `✓ Valid JSON (${fieldCount} fields)` };
    } catch (err) {
      return {
        ok: false,
        label: `⚠ ${err instanceof Error ? err.message : 'Invalid JSON'}`,
      };
    }
  }, [rawJson]);

  const mainConfigOriginalText = useMemo(
    () => formatMainConfigOriginalLayout(rawJson, tabSlug),
    [rawJson, tabSlug]
  );

  // Smart insert into Main Config JSON
  const insertSnippetIntoMainConfig = (jsonStr: string, kindHint?: JsonSnippetKind) => {
    try {
      const incoming = JSON.parse(jsonStr) as Record<string, unknown>;
      const current = JSON.parse(rawJson) as Record<string, unknown>;

      if (
        kindHint === 'schema' ||
        (Array.isArray(incoming.fields) && typeof incoming.tab_id === 'string')
      ) {
        const merged = {
          ...incoming,
          tab_id: tabSlug,
        };
        onChangeRawJson(JSON.stringify(merged, null, 2));
        flashFeedback(`➕ Loaded schema into Main Config (tab_id kept as '${tabSlug}')`);
        return;
      }

      if (
        kindHint === 'field' ||
        (typeof incoming.id === 'string' &&
          typeof incoming.type === 'string' &&
          typeof incoming.label === 'string')
      ) {
        const existingFields = Array.isArray(current.fields)
          ? [...(current.fields as Array<Record<string, unknown>>)]
          : [];
        const existingIdx = existingFields.findIndex((f) => f.id === incoming.id);
        if (existingIdx !== -1) {
          existingFields[existingIdx] = incoming;
          flashFeedback(`🔄 Updated field '${String(incoming.id)}' in Main Config fields[]`);
        } else {
          existingFields.push(incoming);
          flashFeedback(`➕ Added field '${String(incoming.id)}' to Main Config fields[]`);
        }
        onChangeRawJson(JSON.stringify({ ...current, fields: existingFields }, null, 2));
        return;
      }

      // Generic JSON object -> merge keys or store under custom_presets if desired
      const nextConfig = {
        ...current,
        ...incoming,
      };
      onChangeRawJson(JSON.stringify(nextConfig, null, 2));
      flashFeedback('➕ Merged JSON snippet keys into Main Config JSON');
    } catch (err) {
      flashFeedback(
        `⚠ Could not auto-merge JSON (${err instanceof Error ? err.message : String(err)}). Use 📋 Copy & paste manually.`
      );
    }
  };

  const handleLoadIntoStudio = (snippet: JsonSnippet) => {
    try {
      const parsed = JSON.parse(snippet.json) as Record<string, unknown>;
      if (
        snippet.kind === 'field' &&
        typeof parsed.id === 'string' &&
        typeof parsed.type === 'string'
      ) {
        setStudioMode('field');
        setFieldId(parsed.id);
        setFieldLabel(String(parsed.label ?? parsed.id));
        const t = parsed.type as ConfigFieldType;
        setFieldType(
          t === 'checkbox_group' || t === 'number' || t === 'select' || t === 'text'
            ? t
            : 'text'
        );
        if (Array.isArray(parsed.options)) {
          setFieldOptionsText(parsed.options.map(String).join(', '));
        }
        if (Array.isArray(parsed.default)) {
          setFieldDefault(parsed.default.map(String).join(', '));
        } else if (parsed.default !== undefined) {
          setFieldDefault(String(parsed.default));
        }
        if (typeof parsed.min === 'number') setFieldMin(parsed.min);
        if (typeof parsed.max === 'number') setFieldMax(parsed.max);
        setFieldHelp(typeof parsed.help === 'string' ? parsed.help : '');
      } else {
        setStudioMode('custom_json');
        const rows: KvRow[] = Object.entries(parsed).map(([k, v], idx) => {
          if (typeof v === 'number') {
            return { id: `load_${idx}`, key: k, valueType: 'number', rawValue: String(v) };
          }
          if (typeof v === 'boolean') {
            return { id: `load_${idx}`, key: k, valueType: 'boolean', rawValue: String(v) };
          }
          if (Array.isArray(v) && v.every((item) => typeof item !== 'object')) {
            return {
              id: `load_${idx}`,
              key: k,
              valueType: 'array',
              rawValue: v.map(String).join(', '),
            };
          }
          if (typeof v === 'object' && v !== null) {
            return {
              id: `load_${idx}`,
              key: k,
              valueType: 'json',
              rawValue: JSON.stringify(v),
            };
          }
          return { id: `load_${idx}`, key: k, valueType: 'string', rawValue: String(v ?? '') };
        });
        setKvRows(rows.length > 0 ? rows : makeDefaultKvRows());
      }
      setLeftTab('studio');
      flashFeedback(`🛠 Loaded '${snippet.title}' into JSON Creator Studio`);
    } catch {
      flashFeedback('⚠ Unable to parse snippet JSON');
    }
  };

  const handleSaveCreatedSnippet = async () => {
    const title = saveSnippetTitle.trim();
    if (!title) {
      flashFeedback('⚠ Enter a snippet title before saving');
      return;
    }
    const newSnippet: JsonSnippet = {
      id: `custom_${Date.now()}`,
      title,
      category: saveSnippetCategory.trim() || 'Industrial Protocol',
      kind: studioMode === 'field' ? 'field' : 'object',
      description:
        saveSnippetDesc.trim() ||
        `Custom ${studioMode === 'field' ? 'config field' : 'JSON snippet'} created in Studio`,
      json: studioGeneratedJson,
      custom: true,
      createdAt: new Date().toISOString(),
    };
    const next = [newSnippet, ...customSnippets];
    await persistCustomSnippets(next);
    setSaveSnippetTitle('');
    setSaveSnippetDesc('');
    setShowSaveDrawer(false);
    setSelectedCategory('All');
    setLeftTab('library');
    setExpandedSnippetId(newSnippet.id);
    flashFeedback(`💾 Saved '${newSnippet.title}' to Snippet Library`);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col p-4"
        style={{ borderColor: '#cbd5e1' }}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              🧩 JSON Creator Studio, Snippet Library &amp; Main Config — {tabSlug}.json
            </h3>
            <p className="text-[11px] font-mono text-slate-500">
              📂 config/{tabSlug}.json • Create or copy snippets (e.g. Industrial Protocols) &amp;
              paste or insert into Main Config JSON
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLeftTab((prev) => (prev === 'studio' ? 'library' : 'studio'))}
              className="px-2.5 py-1 text-xs font-bold cursor-pointer border"
              style={{
                backgroundColor: leftTab === 'studio' ? '#2563eb' : '#fef9c3',
                borderColor: leftTab === 'studio' ? '#1d4ed8' : '#fde047',
                color: leftTab === 'studio' ? '#ffffff' : '#854d0e',
              }}
              title={
                leftTab === 'studio'
                  ? 'Return to Snippet Library'
                  : 'Open 🛠 JSON Creator Studio'
              }
            >
              🛠 JSON Creator Studio
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  const formatted = JSON.stringify(JSON.parse(rawJson), null, 2);
                  onChangeRawJson(formatted);
                  flashFeedback('✨ Formatted Main Config JSON');
                } catch (err) {
                  flashFeedback(
                    `⚠ Cannot format invalid JSON: ${
                      err instanceof Error ? err.message : String(err)
                    }`
                  );
                }
              }}
              className="px-2.5 py-1 text-xs font-bold cursor-pointer hover:bg-slate-200"
              style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
            >
              ✨ Format JSON
            </button>
            <button
              type="button"
              onClick={() => void onSaveConfig()}
              className="px-3 py-1 text-xs font-bold text-white cursor-pointer hover:opacity-95"
              style={{ backgroundColor: '#16a34a' }}
            >
              💾 Save &amp; Reload Columns
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-700 cursor-pointer hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Status / Feedback Strip */}
        {(studioFeedback || error) && (
          <div
            className={`px-3 py-1.5 mt-2 text-xs font-semibold border shrink-0 ${
              error
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {error || studioFeedback}
          </div>
        )}

        {/* Dual-Pane Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 mt-2.5 overflow-hidden">
          {/* ── LEFT PANE: SNIPPET LIBRARY & JSON CREATOR STUDIO ── */}
          <div
            className="lg:col-span-6 flex flex-col min-h-0 border bg-slate-50"
            style={{ borderColor: '#cbd5e1' }}
          >
            {/* Left Pane Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 pt-1.5 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeftTab('library')}
                  className="px-3 py-1.5 text-xs font-bold cursor-pointer border-t-2"
                  style={{
                    backgroundColor: leftTab === 'library' ? '#eff6ff' : '#f1f5f9',
                    color: leftTab === 'library' ? '#1d4ed8' : '#475569',
                    borderTopColor: leftTab === 'library' ? '#2563eb' : 'transparent',
                  }}
                >
                  📚 Snippet Library ({allSnippets.length})
                </button>
                {leftTab === 'studio' && (
                  <span
                    className="px-2.5 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
                  >
                    🛠 Editing in Studio
                  </span>
                )}
              </div>

              <span className="text-[11px] font-semibold text-slate-400 pr-1 hidden sm:inline">
                Copy or ➕ Insert →
              </span>
            </div>

            {leftTab === 'library' ? (
              <div className="flex-1 min-h-0 flex flex-col p-2.5 gap-2 overflow-hidden">
                {/* Search + Categories */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search snippets (e.g. Modbus, OPC UA, MQTT, PROFINET, field)..."
                  className="w-full px-2.5 py-1.5 text-xs border bg-white focus:outline-none focus:border-blue-500"
                  style={{ borderColor: '#cbd5e1' }}
                />

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className="px-2 py-0.5 text-[11px] font-bold cursor-pointer border"
                        style={{
                          backgroundColor: active ? '#2563eb' : '#ffffff',
                          borderColor: active ? '#2563eb' : '#cbd5e1',
                          color: active ? '#ffffff' : '#475569',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Snippet Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredSnippets.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-500 bg-white border border-slate-200">
                      No matching snippets. Try switching to{' '}
                      <button
                        type="button"
                        onClick={() => setLeftTab('studio')}
                        className="text-blue-600 font-bold underline cursor-pointer"
                      >
                        🛠 JSON Creator Studio
                      </button>{' '}
                      to create &amp; save one!
                    </div>
                  ) : (
                    filteredSnippets.map((snippet) => {
                      const isExpanded = expandedSnippetId === snippet.id;
                      const isCopied = copiedId === snippet.id;
                      return (
                        <div
                          key={snippet.id}
                          className="bg-white border p-2.5"
                          style={{ borderColor: '#cbd5e1' }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div
                              onClick={() =>
                                setExpandedSnippetId(isExpanded ? null : snippet.id)
                              }
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">
                                  {snippet.title}
                                </span>
                                <span
                                  className="px-1.5 py-0.5 text-[10px] font-bold"
                                  style={{
                                    backgroundColor:
                                      snippet.category === 'Industrial Protocol'
                                        ? '#fef3c7'
                                        : '#eff6ff',
                                    color:
                                      snippet.category === 'Industrial Protocol'
                                        ? '#92400e'
                                        : '#1d4ed8',
                                  }}
                                >
                                  {snippet.category}
                                </span>
                                {snippet.custom && (
                                  <span
                                    className="px-1.5 py-0.5 text-[10px] font-bold"
                                    style={{ backgroundColor: '#dcfce7', color: '#166534' }}
                                  >
                                    Saved
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {snippet.description}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  void copyText(snippet.json, snippet.id, snippet.title)
                                }
                                className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                                  isCopied ? 'copy-btn-blink' : 'hover:bg-slate-200'
                                }`}
                                style={
                                  isCopied
                                    ? undefined
                                    : { backgroundColor: '#f1f5f9', color: '#0f172a' }
                                }
                                title="Copy snippet JSON to clipboard"
                              >
                                {isCopied ? '✓ Copied!' : '📋 Copy'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  insertSnippetIntoMainConfig(snippet.json, snippet.kind)
                                }
                                className="px-2 py-1 text-[11px] font-bold text-white cursor-pointer hover:opacity-95"
                                style={{ backgroundColor: '#2563eb' }}
                                title="Insert directly into Main Config JSON on the right"
                              >
                                ➕ Insert
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLoadIntoStudio(snippet)}
                                className="px-2 py-1 text-[11px] font-bold cursor-pointer hover:bg-amber-100"
                                style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}
                                title="Edit this snippet in JSON Creator Studio"
                              >
                                🛠 Studio
                              </button>
                              {snippet.custom && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = customSnippets.filter(
                                      (c) => c.id !== snippet.id
                                    );
                                    void persistCustomSnippets(next);
                                    flashFeedback(`🗑 Deleted snippet '${snippet.title}'`);
                                  }}
                                  className="px-1.5 py-1 text-[11px] font-bold cursor-pointer hover:bg-red-100"
                                  style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                                  title="Delete custom snippet"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <pre
                              className="mt-2 p-2 border text-[11px] max-h-44 overflow-auto select-text"
                              style={{
                                backgroundColor: '#f8fafc',
                                borderColor: '#e2e8f0',
                                fontFamily: "'Consolas', 'Courier New', monospace",
                              }}
                            >
                              {snippet.json}
                            </pre>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* ── 🛠 JSON CREATOR STUDIO TAB ── */
              <div className="flex-1 min-h-0 flex flex-col p-2.5 gap-2 overflow-y-auto">
                {/* Builder Type Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 border border-slate-200 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setStudioMode('field')}
                      className="px-2.5 py-1 text-xs font-bold cursor-pointer"
                      style={{
                        backgroundColor: studioMode === 'field' ? '#2563eb' : '#f1f5f9',
                        color: studioMode === 'field' ? '#ffffff' : '#475569',
                      }}
                    >
                      ⚙ Config Field Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioMode('custom_json')}
                      className="px-2.5 py-1 text-xs font-bold cursor-pointer"
                      style={{
                        backgroundColor: studioMode === 'custom_json' ? '#2563eb' : '#f1f5f9',
                        color: studioMode === 'custom_json' ? '#ffffff' : '#475569',
                      }}
                    >
                      {'{}'} Custom Key-Value Builder
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (studioMode === 'field') {
                        setFieldId('industrial_protocol');
                        setFieldLabel('Industrial Protocol');
                        setFieldType('select');
                        setFieldOptionsText(
                          'Modbus RTU, Modbus TCP, OPC UA, PROFINET, EtherNet/IP, CANopen'
                        );
                        setFieldDefault('Modbus TCP');
                        setFieldHelp('Select industrial protocol.');
                      } else {
                        setKvRows(makeDefaultKvRows());
                      }
                    }}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200"
                  >
                    ↺ Reset Preset
                  </button>
                </div>

                {studioMode === 'field' ? (
                  <div className="bg-white border border-slate-200 p-2.5 space-y-2 text-xs shrink-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Field ID (slug)
                        </label>
                        <input
                          type="text"
                          value={fieldId}
                          onChange={(e) => setFieldId(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Display Label
                        </label>
                        <input
                          type="text"
                          value={fieldLabel}
                          onChange={(e) => setFieldLabel(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Control Type
                        </label>
                        <select
                          value={fieldType}
                          onChange={(e) =>
                            setFieldType(e.target.value as ConfigFieldType)
                          }
                          className="w-full px-2 py-1 border border-slate-300 bg-white text-xs"
                        >
                          <option value="select">select (Dropdown)</option>
                          <option value="checkbox_group">checkbox_group (Multi-Check)</option>
                          <option value="number">number (Numeric)</option>
                          <option value="text">text (String Input)</option>
                        </select>
                      </div>
                    </div>

                    {(fieldType === 'select' || fieldType === 'checkbox_group') && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Options (comma or newline separated)
                        </label>
                        <textarea
                          rows={2}
                          value={fieldOptionsText}
                          onChange={(e) => setFieldOptionsText(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 font-mono text-[11px]"
                        />
                      </div>
                    )}

                    {fieldType === 'number' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                            Min
                          </label>
                          <input
                            type="number"
                            value={fieldMin}
                            onChange={(e) => setFieldMin(Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-300 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                            Max
                          </label>
                          <input
                            type="number"
                            value={fieldMax}
                            onChange={(e) => setFieldMax(Number(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-300 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Default Value{' '}
                          {fieldType === 'checkbox_group' ? '(comma separated)' : ''}
                        </label>
                        <input
                          type="text"
                          value={fieldDefault}
                          onChange={(e) => setFieldDefault(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                          Help Note (optional)
                        </label>
                        <input
                          type="text"
                          value={fieldHelp}
                          onChange={(e) => setFieldHelp(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 p-2.5 space-y-1.5 text-xs shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-600">
                        Key-Value Properties
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setKvRows((prev) => [
                            ...prev,
                            {
                              id: `row_${Date.now()}`,
                              key: `param_${prev.length + 1}`,
                              valueType: 'string',
                              rawValue: 'value',
                            },
                          ])
                        }
                        className="px-2 py-0.5 text-[11px] font-bold text-white cursor-pointer"
                        style={{ backgroundColor: '#2563eb' }}
                      >
                        ＋ Add Key
                      </button>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {kvRows.map((row) => (
                        <div key={row.id} className="grid grid-cols-12 gap-1 items-center">
                          <input
                            type="text"
                            value={row.key}
                            onChange={(e) =>
                              setKvRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, key: e.target.value } : r
                                )
                              )
                            }
                            placeholder="key"
                            className="col-span-4 px-1.5 py-1 border border-slate-300 font-mono text-[11px]"
                          />
                          <select
                            value={row.valueType}
                            onChange={(e) =>
                              setKvRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                        ...r,
                                        valueType: e.target.value as KvRow['valueType'],
                                      }
                                    : r
                                )
                              )
                            }
                            className="col-span-3 px-1 py-1 border border-slate-300 bg-white text-[11px]"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                            <option value="array">array</option>
                            <option value="json">nested json</option>
                          </select>
                          <input
                            type="text"
                            value={row.rawValue}
                            onChange={(e) =>
                              setKvRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, rawValue: e.target.value } : r
                                )
                              )
                            }
                            placeholder="value"
                            className="col-span-4 px-1.5 py-1 border border-slate-300 font-mono text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setKvRows((prev) => prev.filter((r) => r.id !== row.id))
                            }
                            className="col-span-1 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Remove key"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save to Snippet Library Drawer */}
                {showSaveDrawer && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 space-y-2 shrink-0">
                    <div className="text-xs font-bold text-emerald-900">
                      💾 Save Created JSON to Snippet Library
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={saveSnippetTitle}
                        onChange={(e) => setSaveSnippetTitle(e.target.value)}
                        placeholder="Snippet title (e.g. Plant PLC Modbus)"
                        className="px-2 py-1 border border-emerald-300 bg-white text-xs"
                      />
                      <input
                        type="text"
                        value={saveSnippetCategory}
                        onChange={(e) => setSaveSnippetCategory(e.target.value)}
                        placeholder="Category (e.g. Industrial Protocol)"
                        className="px-2 py-1 border border-emerald-300 bg-white text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      value={saveSnippetDesc}
                      onChange={(e) => setSaveSnippetDesc(e.target.value)}
                      placeholder="Short description (optional)"
                      className="w-full px-2 py-1 border border-emerald-300 bg-white text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowSaveDrawer(false)}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveCreatedSnippet()}
                        className="px-3 py-1 text-xs font-bold text-white cursor-pointer"
                        style={{ backgroundColor: '#16a34a' }}
                      >
                        Save Snippet
                      </button>
                    </div>
                  </div>
                )}

                {/* Created JSON Live Preview + Actions */}
                <div className="flex-1 min-h-[140px] flex flex-col bg-white border border-slate-200 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700">
                      ✨ Created JSON Output
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            studioGeneratedJson,
                            'studio_out',
                            'Created Studio JSON'
                          )
                        }
                        className={`px-2 py-1 text-[11px] font-bold cursor-pointer ${
                          copiedId === 'studio_out'
                            ? 'copy-btn-blink'
                            : 'hover:bg-slate-200'
                        }`}
                        style={
                          copiedId === 'studio_out'
                            ? undefined
                            : { backgroundColor: '#f1f5f9', color: '#0f172a' }
                        }
                      >
                        {copiedId === 'studio_out' ? '✓ Copied!' : '📋 Copy JSON'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertSnippetIntoMainConfig(
                            studioGeneratedJson,
                            studioMode === 'field' ? 'field' : 'object'
                          )
                        }
                        className="px-2 py-1 text-[11px] font-bold text-white cursor-pointer"
                        style={{ backgroundColor: '#2563eb' }}
                      >
                        ➕ Add to Main Config
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSaveDrawer((v) => !v)}
                        className="px-2 py-1 text-[11px] font-bold text-white cursor-pointer"
                        style={{ backgroundColor: '#0f766e' }}
                      >
                        💾 Save Snippet
                      </button>
                    </div>
                  </div>

                  <pre
                    className="flex-1 overflow-auto p-2 border text-[11px] select-text"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      fontFamily: "'Consolas', 'Courier New', monospace",
                    }}
                  >
                    {studioGeneratedJson}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANE: MAIN CONFIG JSON EDITOR / ORIGINAL LAYOUT ── */}
          <div className="lg:col-span-6 flex flex-col min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {showMainOriginalLayout
                    ? `📊 Main Config Original Layout (config/${tabSlug}.json)`
                    : `📄 Main Config JSON (config/${tabSlug}.json)`}
                </span>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: mainConfigValidStatus.ok ? '#16a34a' : '#dc2626' }}
                >
                  {mainConfigValidStatus.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      showMainOriginalLayout ? mainConfigOriginalText : rawJson,
                      'main_cfg',
                      showMainOriginalLayout ? 'Main Config Original Layout' : 'Main Config JSON'
                    )
                  }
                  className={`px-2 py-0.5 text-[11px] font-bold cursor-pointer border ${
                    copiedId === 'main_cfg' ? 'copy-btn-blink' : 'hover:bg-slate-200'
                  }`}
                  style={
                    copiedId === 'main_cfg'
                      ? undefined
                      : { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', color: '#0f172a' }
                  }
                  title={
                    showMainOriginalLayout
                      ? 'Copy converted Original Layout text to clipboard'
                      : 'Copy Main Config JSON to clipboard'
                  }
                >
                  {copiedId === 'main_cfg'
                    ? '✓ Copied!'
                    : showMainOriginalLayout
                      ? '📋 Copy Layout'
                      : '📋 Copy Main'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowMainOriginalLayout((v) => !v)}
                  className="px-2 py-0.5 text-[11px] font-bold cursor-pointer border"
                  style={{
                    backgroundColor: showMainOriginalLayout ? '#fef3c7' : '#eff6ff',
                    borderColor: showMainOriginalLayout ? '#f59e0b' : '#93c5fd',
                    color: showMainOriginalLayout ? '#92400e' : '#1d4ed8',
                  }}
                  title="Switch between raw JSON and readable Original Layout (converted text)"
                >
                  {showMainOriginalLayout ? '🔁 JSON View' : '🔁 Original Layout'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudioMode('custom_json');
                    setSaveSnippetTitle(`${tabSlug} Custom Config`);
                    setSaveSnippetCategory('Custom');
                    setSaveSnippetDesc(`Snapshot of config/${tabSlug}.json`);
                    const newSnippet: JsonSnippet = {
                      id: `custom_${Date.now()}`,
                      title: `${tabSlug} Config Backup`,
                      category: 'Custom',
                      kind: 'schema',
                      description: `Saved from Main Config (config/${tabSlug}.json)`,
                      json: rawJson,
                      custom: true,
                      createdAt: new Date().toISOString(),
                    };
                    void persistCustomSnippets([newSnippet, ...customSnippets]);
                    setLeftTab('library');
                    setExpandedSnippetId(newSnippet.id);
                    flashFeedback(`💾 Saved '${newSnippet.title}' to Snippet Library`);
                  }}
                  className="px-2 py-0.5 text-[11px] font-bold cursor-pointer hover:bg-emerald-100"
                  style={{ backgroundColor: '#ecfdf5', color: '#047857' }}
                  title="Save current Main Config JSON as a reusable snippet"
                >
                  💾 Save Config as Snippet
                </button>
              </div>
            </div>

            {showMainOriginalLayout ? (
              <textarea
                readOnly
                value={mainConfigOriginalText}
                spellCheck={false}
                className="flex-1 p-3 border text-xs resize-none focus:outline-none select-text"
                style={{
                  backgroundColor: '#fffbeb',
                  borderColor: '#fcd34d',
                  color: '#1e293b',
                  fontFamily: "'Consolas', 'Courier New', monospace",
                }}
              />
            ) : (
              <textarea
                value={rawJson}
                onChange={(e) => onChangeRawJson(e.target.value)}
                spellCheck={false}
                className="flex-1 p-3 border text-xs resize-none focus:outline-none focus:border-[#2563eb]"
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: mainConfigValidStatus.ok ? '#cbd5e1' : '#fca5a5',
                  fontFamily: "'Consolas', 'Courier New', monospace",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
