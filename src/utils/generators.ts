import type { GeneratedPayload, TabConfigSchema, TabPageData } from '../types/app';

export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

export function noteSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'tab'
  );
}

export function getInitialFieldValues(
  cfg: TabConfigSchema | undefined
): Record<string, string | number | string[]> {
  const values: Record<string, string | number | string[]> = {};
  if (!cfg) return values;

  for (const field of cfg.fields) {
    if (values[field.id] !== undefined) continue;
    if (field.type === 'checkbox_group') {
      values[field.id] = Array.isArray(field.default) ? [...field.default] : [];
    } else if (field.type === 'number') {
      values[field.id] =
        typeof field.default === 'number' ? field.default : (field.min ?? 1);
    } else if (field.type === 'select') {
      values[field.id] =
        typeof field.default === 'string'
          ? field.default
          : (field.options?.[0] ?? '');
    } else {
      values[field.id] = typeof field.default === 'string' ? field.default : '';
    }
  }
  return values;
}

function filterRecord(
  rowData: Record<string, string | number | boolean>,
  selectedCols: string[] | null,
  excludedRowKeys: Set<string>,
  customKeys: string[]
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const customSet = new Set(customKeys);
  for (const key of Object.keys(rowData)) {
    if (excludedRowKeys.has(key)) continue;
    if (selectedCols === null || selectedCols.includes(key) || customSet.has(key)) {
      out[key] = rowData[key];
    }
  }
  return out;
}

const PARAM_TO_ROW_KEYS: Record<string, Record<string, string[]>> = {
  vp_addresses: {
    starting_vp_address: ['address_hex', 'address_dec'],
    variable_prefix: ['variable_name'],
    data_type: ['data_type'],
    access_mode: ['access_mode'],
  },
  sensors: {
    sensor_category: ['sensor_type'],
    sampling_rate_ms: ['sampling_rate_ms'],
    location_zone: ['location'],
  },
  parameters: {
    parameter_group: ['group'],
    unit_family: ['unit'],
    prefix: ['name'],
  },
  topics: {
    broker_protocol: ['description'],
    root_namespace: ['topic_name'],
    qos_level: ['qos'],
    payload_format: ['payload_type'],
  },
  communication: {
    protocol_type: ['protocol'],
    target_host: ['endpoint'],
    target_port: ['port_baud'],
    timeout_ms: ['timeout_ms'],
    retry_limit: ['retry_limit'],
  },
  features: {
    default_state: ['enabled'],
  },
};

const KNOWN_BUILTIN_PARAMS: Record<string, Set<string>> = {
  vp_addresses: new Set([
    'source_columns',
    'num_records',
    'starting_vp_address',
    'address_increment',
    'data_type',
    'access_mode',
    'variable_prefix',
  ]),
  sensors: new Set([
    'source_columns',
    'num_records',
    'sensor_category',
    'sampling_rate_ms',
    'location_zone',
  ]),
  parameters: new Set([
    'source_columns',
    'num_records',
    'parameter_group',
    'unit_family',
    'prefix',
  ]),
  topics: new Set([
    'source_columns',
    'num_records',
    'broker_protocol',
    'root_namespace',
    'qos_level',
    'payload_format',
  ]),
  communication: new Set([
    'source_columns',
    'num_records',
    'protocol_type',
    'target_host',
    'target_port',
    'timeout_ms',
    'retry_limit',
  ]),
  features: new Set(['source_columns', 'num_records', 'default_state']),
};

export function generateCurrentJson(params: {
  tabSlug: string;
  cfg?: TabConfigSchema;
  fieldVals: Record<string, string | number | string[]>;
  includedFieldIds?: string[];
  windowId: number;
  projectId: string;
  requestId: string | null;
}): GeneratedPayload {
  const { tabSlug, cfg, fieldVals, includedFieldIds, windowId, projectId, requestId } = params;
  const genType = cfg?.generator_type ?? tabSlug;
  const winNum = windowId;
  const winKey = `window${winNum}`;

  const allFieldKeys = new Set<string>([
    ...(cfg?.fields.map((f) => f.id) ?? []),
    ...Object.keys(fieldVals),
  ]);
  const includedSet = includedFieldIds ? new Set(includedFieldIds) : allFieldKeys;

  const activeFieldVals: Record<string, string | number | string[]> = {};
  for (const key of Object.keys(fieldVals)) {
    if (includedSet.has(key)) {
      activeFieldVals[key] = fieldVals[key];
    }
  }

  // If no items are ticked/included, return empty data & empty parameters_applied
  if (includedSet.size === 0) {
    return {
      metadata: {
        contract_version: '2.0',
        request_id: requestId,
        project_id: projectId,
        tab_id: tabSlug,
        tab_name: cfg?.tab_title ?? tabSlug,
        target_window_id: winNum,
        target_window_key: winKey,
        generated_at: new Date().toISOString(),
        record_count: 0,
      },
      parameters_applied: {},
      data: [],
    };
  }

  const excludedRowKeys = new Set<string>();
  const paramMap = PARAM_TO_ROW_KEYS[genType] ?? {};
  for (const [paramId, rowKeys] of Object.entries(paramMap)) {
    if (allFieldKeys.has(paramId) && !includedSet.has(paramId)) {
      for (const rk of rowKeys) excludedRowKeys.add(rk);
    }
  }

  const builtinSet = KNOWN_BUILTIN_PARAMS[genType] ?? new Set(['source_columns', 'num_records']);
  const customIncludedKeys: string[] = [];
  const customRowProps: Record<string, string | number | boolean> = {};
  for (const key of includedSet) {
    if (!builtinSet.has(key) && activeFieldVals[key] !== undefined) {
      const rawVal = activeFieldVals[key];
      customIncludedKeys.push(key);
      customRowProps[key] = Array.isArray(rawVal) ? rawVal.join(', ') : rawVal;
    }
  }

  const rawNumRecords = includedSet.has('num_records')
    ? Number(activeFieldVals.num_records ?? 5)
    : 1;
  const numRecords = Number.isFinite(rawNumRecords)
    ? Math.max(1, Math.min(500, Math.floor(rawNumRecords)))
    : 5;

  const sourceColsIncluded = includedSet.has('source_columns');

  const records: Array<Record<string, string | number | boolean>> = [];

  if (genType === 'vp_addresses') {
    const startStr = String(activeFieldVals.starting_vp_address ?? '0x1000').trim();
    let baseAddr = 0x1000;
    try {
      const parsed = startStr.toLowerCase().startsWith('0x')
        ? parseInt(startStr, 16)
        : parseInt(startStr, 10);
      if (!Number.isNaN(parsed)) baseAddr = parsed;
    } catch {
      baseAddr = 0x1000;
    }

    const increment = includedSet.has('address_increment')
      ? Math.max(1, Number(activeFieldVals.address_increment ?? 2) || 2)
      : 1;
    const dtype = String(activeFieldVals.data_type ?? 'UINT16');
    const access = String(activeFieldVals.access_mode ?? 'Read / Write');
    const prefix = String(activeFieldVals.variable_prefix ?? 'VP_ADDR_');
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['address_hex', 'address_dec', 'variable_name', 'data_type', 'access_mode']
      : null;

    const winOffset = (winNum - 1) * numRecords * increment;
    const windowBaseAddr = baseAddr + winOffset;

    for (let i = 0; i < numRecords; i++) {
      const currAddr = windowBaseAddr + i * increment;
      const slot = String(i + 1).padStart(2, '0');
      const rowData: Record<string, string | number | boolean> = {
        address_hex: `0x${currAddr.toString(16).toUpperCase().padStart(4, '0')}`,
        address_dec: currAddr,
        variable_name: `${prefix}W${winNum}_${slot}`,
        data_type: dtype,
        access_mode: access,
        default_value: 0,
        description: `VP Register for ${winKey} slot ${slot}`,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else if (genType === 'sensors') {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['sensor_id', 'sensor_name', 'sensor_type', 'unit', 'sampling_rate_ms', 'status']
      : null;
    const cat = String(activeFieldVals.sensor_category ?? 'Environmental');
    const rate = Number(activeFieldVals.sampling_rate_ms ?? 1000) || 1000;
    const zone = String(activeFieldVals.location_zone ?? `Zone-${winNum}`);

    const sensorProfiles: Array<[string, string, number, number]> = [
      ['Temperature', '°C', 0.0, 100.0],
      ['Humidity', '%RH', 10.0, 90.0],
      ['Pressure', 'hPa', 950.0, 1050.0],
      ['Vibration', 'mm/s', 0.0, 15.0],
      ['Current', 'Amps', 0.0, 30.0],
      ['Voltage', 'Volts', 200.0, 240.0],
    ];

    for (let i = 0; i < numRecords; i++) {
      const prof = sensorProfiles[i % sensorProfiles.length];
      const rowData: Record<string, string | number | boolean> = {
        sensor_id: `SNS_W${winNum}_${String(i + 1).padStart(3, '0')}`,
        sensor_name: `${prof[0]} Sensor W${winNum}_${i + 1}`,
        sensor_type: cat,
        pin_channel: `CH_W${winNum}_${i}`,
        unit: prof[1],
        sampling_rate_ms: rate,
        min_threshold: prof[2],
        max_threshold: prof[3],
        status: 'ONLINE',
        location: zone,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else if (genType === 'parameters') {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : [
            'param_id',
            'name',
            'group',
            'data_type',
            'default_value',
            'min_limit',
            'max_limit',
            'unit',
          ]
      : null;
    const grp = String(activeFieldVals.parameter_group ?? 'General');
    const unit = String(activeFieldVals.unit_family ?? '%');
    const prefix = String(activeFieldVals.prefix ?? 'PARAM_');
    const baseParamId = winNum * 100 + 1;

    for (let i = 0; i < numRecords; i++) {
      const rowData: Record<string, string | number | boolean> = {
        param_id: baseParamId + i,
        name: `${prefix}W${winNum}_${String(i + 1).padStart(2, '0')}`,
        group: `${grp} (W${winNum})`,
        data_type: 'FLOAT32',
        default_value: Number((10.0 * (i + 1)).toFixed(2)),
        min_limit: 0.0,
        max_limit: 100.0,
        unit,
        read_only: false,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else if (genType === 'topics') {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['topic_name', 'direction', 'qos', 'retained', 'payload_type', 'description']
      : null;
    const protocol = String(activeFieldVals.broker_protocol ?? 'MQTT');
    const ns = String(
      activeFieldVals.root_namespace ?? `devices/station_${String(winNum).padStart(2, '0')}`
    );
    const qosStr = String(activeFieldVals.qos_level ?? '1');
    const qos = Number.parseInt(qosStr.charAt(0), 10);
    const payloadFmt = String(activeFieldVals.payload_format ?? 'JSON');

    const subtopics = ['telemetry', 'alerts', 'state', 'commands', 'heartbeat'];
    for (let i = 0; i < numRecords; i++) {
      const sub = subtopics[i % subtopics.length];
      const rowData: Record<string, string | number | boolean> = {
        topic_name: `${ns}/w${winNum}/${sub}_${i + 1}`,
        direction: ['telemetry', 'alerts', 'heartbeat'].includes(sub)
          ? 'PUBLISH'
          : 'SUBSCRIBE',
        qos: Number.isNaN(qos) ? 1 : qos,
        retained: ['state', 'alerts'].includes(sub),
        payload_type: payloadFmt,
        description: `Channel for ${sub} messages (${protocol}) on ${winKey}`,
        rate_hz: 1.0,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else if (genType === 'communication') {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['interface_id', 'protocol', 'endpoint', 'port_baud', 'timeout_ms', 'retry_limit']
      : null;
    const proto = String(activeFieldVals.protocol_type ?? 'Modbus TCP/IP');
    const host = String(activeFieldVals.target_host ?? `192.168.1.${100 + winNum}`);
    const port = String(activeFieldVals.target_port ?? '502');
    const timeout = Number(activeFieldVals.timeout_ms ?? 1500) || 1500;
    const retry = Number(activeFieldVals.retry_limit ?? 3);

    for (let i = 0; i < numRecords; i++) {
      const rowData: Record<string, string | number | boolean> = {
        interface_id: `COMM_W${winNum}_IF_${String(i + 1).padStart(2, '0')}`,
        protocol: proto,
        endpoint:
          proto.includes('TCP') || proto.includes('EtherNet') || proto.includes('WebSocket')
            ? `${host}:${port}`
            : `/dev/ttyUSB${winNum}_${i}`,
        port_baud: port,
        timeout_ms: timeout,
        retry_limit: Number.isNaN(retry) ? 3 : retry,
        status: 'CONFIGURED',
        keepalive_sec: 30,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else if (genType === 'features') {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['feature_id', 'name', 'category', 'enabled', 'license_tier']
      : null;
    const defaultState = String(activeFieldVals.default_state ?? 'Enabled (true)');
    const categories = ['Telemetry', 'Diagnostics', 'Security', 'Automation', 'Networking'];
    const tiers = ['Core', 'Standard', 'Enterprise'];

    for (let i = 0; i < numRecords; i++) {
      const enabledVal =
        defaultState.startsWith('Enabled')
          ? true
          : defaultState.startsWith('Disabled')
            ? false
            : i % 2 === 0;
      const rowData: Record<string, string | number | boolean> = {
        feature_id: `FEAT_W${winNum}_${String(i + 1).padStart(2, '0')}`,
        name: `Feature Module W${winNum}_${i + 1}`,
        category: categories[i % categories.length],
        enabled: enabledVal,
        beta_flag: i % 3 === 0,
        license_tier: tiers[i % tiers.length],
        description: `Capability toggle for ${winKey} slot ${i + 1}`,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  } else {
    const selectedCols = sourceColsIncluded
      ? Array.isArray(activeFieldVals.source_columns)
        ? activeFieldVals.source_columns
        : ['id', 'name', 'value']
      : null;
    const nowIso = new Date().toISOString();
    for (let i = 0; i < numRecords; i++) {
      const rowData: Record<string, string | number | boolean> = {
        id: winNum * 10 + i + 1,
        name: `${tabSlug}_w${winNum}_item_${i + 1}`,
        value: Number(((i + 1) * 3.1415).toFixed(2)),
        status: 'ACTIVE',
        timestamp: nowIso,
        ...customRowProps,
      };
      records.push(filterRecord(rowData, selectedCols, excludedRowKeys, customIncludedKeys));
    }
  }

  return {
    metadata: {
      contract_version: '2.0',
      request_id: requestId,
      project_id: projectId,
      tab_id: tabSlug,
      tab_name: cfg?.tab_title ?? tabSlug,
      target_window_id: winNum,
      target_window_key: winKey,
      generated_at: new Date().toISOString(),
      record_count: records.length,
    },
    parameters_applied: { ...activeFieldVals },
    data: records,
  };
}

export function jsonToOriginalForm(rawContent: string, windowId: number): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return rawContent;
  }

  let meta: Record<string, unknown> = {};
  let records: Array<Record<string, unknown>> = [];

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    meta = (obj.metadata as Record<string, unknown>) ?? {};
    if (Array.isArray(obj.data)) {
      records = obj.data as Array<Record<string, unknown>>;
    } else {
      records = [obj];
    }
  } else if (Array.isArray(parsed)) {
    records = parsed.map((item) =>
      item && typeof item === 'object' ? (item as Record<string, unknown>) : { value: item }
    );
  }

  const tabName = String(meta.tab_name ?? 'Data');
  const winKey = String(meta.target_window_key ?? `window${windowId}`);
  const genAt = String(meta.generated_at ?? '');
  const recCount = Number(meta.record_count ?? records.length);
  const projId = String(meta.project_id ?? '');

  const sep = '═'.repeat(74);
  const lines: string[] = [sep, `  TAB : ${tabName.toUpperCase()}`];
  if (projId) {
    lines.push(`  PROJECT : ${projId}`);
  }
  lines.push(
    `  ${winKey.toUpperCase()}  •  ${recCount} record(s)` +
      (genAt ? `  •  Generated: ${genAt.slice(0, 19)}` : '')
  );
  lines.push(sep);

  if (!records.length) {
    lines.push('  (no records)');
    lines.push(sep);
    return lines.join('\n');
  }

  const cols =
    records[0] && typeof records[0] === 'object' ? Object.keys(records[0]) : ['value'];

  const colW: Record<string, number> = {};
  for (const c of cols) {
    const maxValW = records.reduce((max, r) => {
      const len = String(r?.[c] ?? '').length;
      return len > max ? len : max;
    }, 0);
    colW[c] = Math.max(c.length, maxValW);
  }

  lines.push(cols.map((c) => c.toUpperCase().padEnd(colW[c])).join('  '));
  lines.push(cols.map((c) => '─'.repeat(colW[c])).join('  '));

  for (const r of records) {
    lines.push(cols.map((c) => String(r?.[c] ?? '').padEnd(colW[c])).join('  '));
  }

  lines.push(sep);

  const paramsApplied =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? ((parsed as Record<string, unknown>).parameters_applied as
          | Record<string, unknown>
          | undefined)
      : undefined;

  if (paramsApplied) {
    lines.push('');
    lines.push('  Generation Parameters Applied:');
    lines.push('  ' + '─'.repeat(40));
    for (const [k, v] of Object.entries(paramsApplied)) {
      const valStr = Array.isArray(v) ? v.join(', ') : String(v);
      lines.push(`  ${k.padEnd(30)} ${valStr}`);
    }
  }

  return lines.join('\n');
}

export function formatWindowOriginalForm(
  rawContent: string,
  windowId: number,
  tabName = 'Data'
): { isJson: boolean; isEmpty: boolean; text: string } {
  const trimmed = rawContent.trim();
  const sep = '═'.repeat(74);

  if (!trimmed) {
    return {
      isJson: false,
      isEmpty: true,
      text: [
        sep,
        `  TAB : ${tabName.toUpperCase()}`,
        `  WINDOW${windowId}  •  (empty)`,
        sep,
        '  (no content / not generated yet)',
        sep,
      ].join('\n'),
    };
  }

  try {
    JSON.parse(trimmed);
    return {
      isJson: true,
      isEmpty: false,
      text: jsonToOriginalForm(trimmed, windowId),
    };
  } catch {
    return {
      isJson: false,
      isEmpty: false,
      text: [
        sep,
        `  TAB : ${tabName.toUpperCase()}`,
        `  WINDOW${windowId}  •  Plain Text`,
        sep,
        trimmed,
        sep,
      ].join('\n'),
    };
  }
}

export function formatAllWindowsOriginalForm(
  windows: Array<{ windowId: number; content: string }>,
  tabName: string
): string {
  const header = [
    '█'.repeat(74),
    `  ALL WINDOWS ORIGINAL FORM  •  TAB: ${tabName.toUpperCase()}  •  ${windows.length} WINDOW(S)`,
    '█'.repeat(74),
    '',
  ].join('\n');

  const sections = windows.map(
    ({ windowId, content }) =>
      formatWindowOriginalForm(content, windowId, tabName).text
  );

  return header + sections.join('\n\n');
}

export function tabToText(page: TabPageData): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const lines: string[] = [
    '='.repeat(70),
    `  TAB : ${page.tab_name}`,
    `  Saved: ${stamp}`,
    '='.repeat(70),
    '',
  ];

  page.windows.forEach((w, idx) => {
    const body = w.content.trim();
    lines.push('─'.repeat(70), `  WINDOW ${idx + 1}`, '─'.repeat(70), body || '(empty)', '');
  });

  return lines.join('\n');
}
