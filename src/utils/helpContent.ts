export interface OverlayItem {
  title: string;
  description: string;
}

export type OverlayMap = Record<string, OverlayItem>;

export interface ParsedHelpSection {
  title: string;
  items: Array<{ label: string; text: string }>;
}

export const DEFAULT_GUI1_HELP_TXT = `# GUI1 HELP — NOTE TOOL WORKSPACE (help/gui1_help.txt)
# Edit this text file directly or via the "Edit .txt File" tab inside the Help modal.

=== Overview ===
- GUI1 (Note Tool): Multi-tab structured note and JSON workspace connected to GUI2 via the IPC bridge. Each tab holds resizable note windows (Window 1..N) in Vertical or Horizontal layout, and changed projects auto-save every 1 minute.

=== Top Menu Bar Buttons ===
- 📁 Default Dir: Sets the default folder under saved_projects/ used by Save Project, Save All, and 1-minute Auto-Save.
- 🆕 New Project (Ctrl+N): Creates a fresh project with default tabs after choosing a project name and folder.
- 📂 Load Project (Ctrl+O): Opens a saved .notetool or .json project file from your computer.
- 💾 Save Project (Ctrl+S): Prompts for directory and file name, then saves the entire project as <name>.notetool (with optional browser download).
- 💾 Save All: Prompts for directory and base name, then exports every tab as <tab>.txt plus a combined <name>_all_tabs.txt file.
- 🗑 Clear Tab: Clears text across all windows in the active tab (with confirmation).
- ⚡ Generate Data: Dispatches the active tab and currently focused window to GUI2 so you can generate structured JSON for it.
- ❓ Help: Opens this text-file-based Help guide (loaded from help/gui1_help.txt) with a built-in .txt editor.

=== Dynamic Tab Bar & Toolbar ===
- Tab Click / Double-Click / ✕ / ＋: Click to switch tabs, double-click a tab title to rename it, click ✕ to close a tab, or click ＋ to add a new tab.
- ＋ Add Window: Appends a new note window to the active tab.
- 🗑 Clear All Windows: Clears all windows inside the active tab.
- ⬛ Vertical / ⬜ Horizontal: Switches the active tab layout between stacked vertical windows and side-by-side horizontal windows.

=== Window Header & Navigation Controls ===
- A+ / A- / B / I / 🎨: Adjusts font size, bold, italic, and text colour for that individual window.
- 📊 Original Form: Opens the multi-window tabbed viewer showing formatted tables across All Windows or any individual window, with Focus, Generate, Copy, and Download actions.
- 🗑 Clear: Clears text in that individual window (with confirmation).
- ⋮ Context Menu: Opens quick tools (Copy All Text, Original Form, Clear Window, Insert Date/Time/Divider, Duplicate Window, Height presets, and Wrap mode).
- ◀ Prev / Next ▶ / 1..N: Navigates quickly between windows in the active tab.

=== Top Suite Header Controls ===
- Auto-Save (1m): Automatically saves modified projects every 1 minute (the black top header blinks green when auto-saved). Click anytime to save immediately.
- 🏷 Overlays (ON/OFF): Toggles click-editable helper overlay descriptions on every UI component across GUI1 and GUI2.
`;

export const DEFAULT_GUI2_HELP_TXT = `# GUI2 HELP — DYNAMIC JSON GENERATOR & WINDOW CANVAS (help/gui2_help.txt)
# Edit this text file directly or via the "Edit .txt File" tab inside the Help modal.

=== Overview ===
- GUI2 (JSON Generator): Schema-driven JSON builder powered by config/*.json files. Select parameter options on the left pane and populate, preview, inspect, or dispatch JSON across windows 1–7 back to GUI1.

=== Top Banner Buttons ===
- 📜 History: Opens output generation history (output/generation_history.jsonl) with download buttons for previously dispatched files.
- 🔄 Reload Configs: Reloads all config/*.json schema definitions from the server.
- ❓ Help: Opens this text-file-based Help guide (loaded from help/gui2_help.txt) with a built-in .txt editor.

=== Left Parameter Pane ===
- Schema Tabs: Switch between parameter schemas (VP Addresses, Communication, Features, Parameter, Parameters, Sensors, Topics).
- Dynamic Fields: Checkboxes, dropdowns, number, and text inputs define the columns, rows, and metadata included when generating JSON.
- 📄 View Config JSON: Opens the editable config/<tab>.json schema editor so you can add/remove options and click Save & Reload Columns.

=== Windows Canvas Header Buttons ===
- ⚡ Gen windowN: Generates JSON from the left parameters into the currently selected Active Target window (windowN).
- ⚡ Gen ALL Windows (1-7): Generates JSON across all 7 windows (window1–window7) in the active tab.
- 🗑 Clear All Windows: Clears the JSON text in all 7 windows of the active tab.

=== Per-Window Card Buttons (window1–window7) ===
- 📊 Original Form: Opens the multi-window tabbed tabular viewer (All Windows 1–7 or individual Window 1..7 tabs) with Set Target, Gen, Copy, and Download actions.
- 📋 Copy: Copies that window's JSON text to the clipboard.
- ⚡ Gen JSON: Sets that window as the Active Target and immediately generates JSON into it.
- 🎯 Set Target / 🎯 Target: Marks that window (window1–window7) as the Active Target (highlighted in blue), controlling which window ⚡ Gen windowN, Live JSON Preview, and bottom 💾 Send to windowN operate on.
- 💾 Send: Sends that specific window's JSON directly to the matching tab and window in GUI1 (auto-generating first if empty).
- 🗑 Clear: Clears that individual window's JSON buffer.

=== Bottom Action Bar ===
- 🔍 Live JSON Preview (Pop-up): Previews the live JSON that will be generated for the Active Target window without modifying the card.
- 💾 Send to windowN: Generates and dispatches the Active Target window's JSON to GUI1 and saves an output file.
- ⚡ Send ALL Windows (1-7): Generates and dispatches all 7 windows to GUI1 as a batch.
`;

export const DEFAULT_OVERLAYS_TXT = `[suite_header]
title = Suite Header & Mode Switcher
description = Switches between GUI1 (Note Tool), Split Dual-View, and GUI2 (JSON Generator). Houses the 1-minute Auto-Save button (header blinks green when saved) and the Component Overlay toggle.

[gui1_menubar]
title = GUI1 Menu Bar
description = Project management toolbar: Default Dir, New Project (Ctrl+N), Load Project (Ctrl+O), Save Project (Ctrl+S), Save All (.txt export), Clear Tab, Generate Data (IPC to GUI2), and Help.

[gui1_tabbar]
title = GUI1 Dynamic Tab Bar
description = Switch between project tabs, double-click any tab name to rename it, click ✕ to close a tab, or click ＋ to add a new tab.

[gui1_toolbar]
title = GUI1 Tab Toolbar
description = Displays the active tab name and window count, with controls to Add Window, Clear All Windows, and toggle Vertical/Horizontal window layout.

[gui1_canvas]
title = GUI1 Note Windows Canvas
description = Scrollable workspace holding Window 1..N cards. Each window supports font size/bold/italic/colour formatting, Original Form multi-window viewer, Clear, resize drag handle, and ⋮ context menu.

[gui1_navbar]
title = GUI1 Window Navigator
description = Quick navigation bar with Prev/Next and numbered window buttons (1..N) to focus and scroll directly to any window.

[gui2_banner]
title = GUI2 Top Banner
description = Displays active Project, Tab, and Target Window alongside GUI1 IPC status, Output History, Reload Configs, and GUI2 Help.

[gui2_tabbar]
title = GUI2 Schema Tabs
description = Switches between config/*.json schemas (VP Addresses, Communication, Features, Parameter, Parameters, Sensors, Topics).

[gui2_params]
title = GUI2 Parameter Selectors
description = Dynamic form generated from config/<tab>.json fields. Configure columns, counts, and options here, or click View Config JSON to edit the schema directly.

[gui2_canvas_header]
title = GUI2 Canvas Controls
description = Shows the current Active Target (windowN) and provides batch actions: Gen windowN, Gen ALL Windows (1-7), and Clear All Windows.

[gui2_window_cards]
title = GUI2 Window Cards (1-7)
description = Seven independent JSON buffers (window1–window7). Each card has Original Form, Copy, Gen JSON, Set Target (selects Active Target), Send (dispatches to GUI1), and Clear.

[gui2_bottom_bar]
title = GUI2 Bottom Dispatch Bar
description = Displays status messages and provides Live JSON Preview, Send to windowN (dispatches Active Target to GUI1), and Send ALL Windows (1-7).
`;

export function parseHelpSections(rawTxt: string): ParsedHelpSection[] {
  const sections: ParsedHelpSection[] = [];
  let current: ParsedHelpSection | null = null;

  for (const rawLine of rawTxt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^===\s*(.+?)\s*===$/);
    if (sectionMatch) {
      current = { title: sectionMatch[1], items: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: 'Notes', items: [] };
      sections.push(current);
    }

    const cleaned = line.replace(/^[-*•]\s*/, '');
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx > 0 && colonIdx < 48) {
      current.items.push({
        label: cleaned.slice(0, colonIdx).trim(),
        text: cleaned.slice(colonIdx + 1).trim(),
      });
    } else {
      current.items.push({ label: '', text: cleaned });
    }
  }

  return sections;
}

export function parseOverlaysTxt(rawTxt: string): OverlayMap {
  const map: OverlayMap = {};
  let currentId: string | null = null;

  for (const rawLine of rawTxt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const headerMatch = line.match(/^\[([a-zA-Z0-9_-]+)\]$/);
    if (headerMatch) {
      currentId = headerMatch[1];
      if (!map[currentId]) {
        map[currentId] = { title: currentId, description: '' };
      }
      continue;
    }

    if (!currentId) continue;

    if (line.startsWith('title =')) {
      map[currentId].title = line.slice('title ='.length).trim();
    } else if (line.startsWith('description =')) {
      map[currentId].description = line.slice('description ='.length).trim();
    } else if (map[currentId].description) {
      map[currentId].description += `\n${line}`;
    } else {
      map[currentId].description = line;
    }
  }

  return map;
}

export function serializeOverlaysTxt(map: OverlayMap): string {
  const keys = Object.keys(map);
  return (
    keys
      .map((key) => {
        const item = map[key];
        const safeDesc = item.description.replace(/\r/g, '').trim();
        return `[${key}]\ntitle = ${item.title.trim()}\ndescription = ${safeDesc}`;
      })
      .join('\n\n') + '\n'
  );
}
