export type WrapMode = 'word' | 'char' | 'none';
export type TabOrientation = 'vertical' | 'horizontal';
export type WorkspaceMode = 'gui1' | 'gui2' | 'split';

export interface NoteWindowMeta {
  font_size: number;
  font_color: string;
  bold: boolean;
  italic: boolean;
  height: number;
  win_width: number;
  wrap?: WrapMode;
}

export interface NoteWindowData {
  id: string;
  content: string;
  meta: NoteWindowMeta;
}

export interface TabPageData {
  id: string;
  tab_name: string;
  orient: TabOrientation;
  windows: NoteWindowData[];
  focused_index: number;
}

export interface NoteToolProject {
  version: number;
  saved: string;
  project_name: string;
  save_dir: string;
  tabs: TabPageData[];
}

export type ConfigFieldType = 'checkbox_group' | 'number' | 'select' | 'text';

export interface ConfigField {
  id: string;
  label: string;
  type: ConfigFieldType;
  options?: string[];
  default?: string | number | string[];
  min?: number;
  max?: number;
  help?: string;
}

export interface TabConfigSchema {
  tab_id: string;
  tab_title: string;
  description: string;
  version: string;
  fields: ConfigField[];
  generator_type: string;
}

export interface GeneratedPayload {
  metadata: {
    contract_version: string;
    request_id: string | null;
    project_id: string;
    tab_id: string;
    tab_name: string;
    target_window_id: number;
    target_window_key: string;
    generated_at: string;
    record_count: number;
  };
  parameters_applied: Record<string, string | number | string[]>;
  data: Array<Record<string, string | number | boolean>>;
}

export interface GenerateRequestPayload {
  type: 'GENERATE_REQUEST';
  request_id: string;
  project_id: string;
  tab_id: string;
  tab_name: string;
  window_id: number;
  window_content: string;
  all_tabs_data: Record<string, string[]>;
  timestamp: string;
}

export interface GenerateResponsePayload {
  type: 'GENERATE_RESPONSE';
  request_id: string | null;
  project_id: string;
  tab_id: string;
  tab_name: string;
  window_id: number;
  window_key: string;
  file_name: string;
  json_str: string;
  all_windows?: Record<number, string>;
}

export interface OutputHistoryEntry {
  timestamp: string;
  file: string;
  request_id: string | null;
  tab: string;
  window: number | string;
  records: number;
  json_preview?: string;
}

export type JsonSnippetKind = 'field' | 'schema' | 'object';

export interface JsonSnippet {
  id: string;
  title: string;
  category: string;
  kind: JsonSnippetKind;
  description: string;
  json: string;
  custom?: boolean;
  createdAt?: string;
}
