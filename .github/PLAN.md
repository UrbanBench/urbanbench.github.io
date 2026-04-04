# Plan: UrbanBench Conversation Viewer (`urbanbench.github.io`)

Build a single-page, zero-dependency static site for `urbanbench.github.io` that visualises
agent–user conversation simulations produced by `dynamic_validator_results.json`.

**Kim chỉ nam**: nhìn vào conversation là biết ngay đây là urban-domain benchmark —
mỗi tool call được render với group badge + icon đặc trưng (Map / Web / Database / Generic).

---

## Tool Group Classification

| Group | Icon | Color | Tools |
|---|---|---|---|
| **Map Tool** | 🗺️ | `#3b82f6` blue | `text_search`, `place_details`, `nearby_search`, `compute_routes`, `search_along_route` |
| **Web Tool** | 🌐 | `#10b981` green | `read_place_website`, `get_transit_schedule`, `search_venue_events`, `check_availability` |
| **Database Tool** | 🗄️ | `#8b5cf6` purple | `book_place`, `submit_council_report` |
| **Generic Tool** | ⚙️ | `#f59e0b` amber | `transfer_to_human_agents` |

---

## JSON Message Format (confirmed from real file)

| Pattern | Meaning |
|---|---|
| `role:"assistant"` + non-null `content` | Agent text reply |
| `role:"assistant"` + `content:null` + `tool_calls:[{id,name,arguments}]` | Tool invocation |
| `role:"tool"` + `id` matching tool call | Tool result |
| `role:"user"` | User message |

`reward_info` contains: `action_results[]` (per-step match + reward), `nl_assertions[]`
(met + justification), `reward_breakdown` {DB, COMMUNICATE, …}.

---

## Architecture Decision

**Vanilla HTML + CSS + JavaScript (ES Modules)** — no Node.js, no build step.
- GitHub Pages serves static files directly; zero-dependency
- Consistent with deploy target (`urbanbench.github.io`)
- Modern browsers support `<script type="module">` natively
- Reference leaderboard in `tau2-bench/web/leaderboard/` uses React+Vite (not reusable here)

---

## File Structure

```
urbanbench.github.io/
├── index.html               ← app shell, imports CSS + JS modules
├── css/
│   ├── theme.css            ← CSS custom properties, global reset, header
│   └── components.css       ← sidebar, conversation, tool cards, bubbles
├── js/
│   ├── toolClassifier.js    ← tool name → {group, icon, color, bg, border}
│   ├── messageParser.js     ← raw messages[] → structured turns[]
│   ├── dataLoader.js        ← index tasks + simulations from JSON
│   └── app.js               ← app logic, state, rendering, events
└── data/
    └── sample.json          ← copy of dynamic_validator_results.json (demo data)
```

---

## Implementation Steps

### Phase 1 — Core Utilities
1. `js/toolClassifier.js` — map each tool name → `{group, label, icon, color, bgColor, borderColor}`
2. `js/messageParser.js` — parse `messages[]` into structured turns:
   - Pair `role:"assistant"` tool_call with matching `role:"tool"` result by `id`
   - Return ordered array of `{type, ...}` objects
3. `js/dataLoader.js` — from root JSON:
   - Build `tasksMap[task_id]` → task metadata
   - Build `simulations[]` list sorted by task_id
   - Compute per-simulation aggregate score from `reward_info`

### Phase 2 — Styling
4. `css/theme.css` — CSS vars, city-grid header background, global typography
5. `css/components.css` — all component rules:
   - Sidebar: list items, task-type badges (8 colors), termination badges, score chips
   - Tool cards: left-colored border, group badge, collapsible JSON sections
   - Message bubbles: user (right, blue), agent (left, gray), tool result inline
   - TaskInfoPanel: evaluation actions list, reward breakdown table

### Phase 3 — Application Logic
6. `js/app.js`:
   - Auto-fetch `data/sample.json` on page load (fetch API, graceful fallback)
   - File upload handler: FileReader API, parses JSON, re-renders
   - Sidebar filter by task type (multi-select)
   - Sidebar click → load conversation into main pane
   - Collapsible JSON sections (click to expand/collapse)
   - Tool call card fully assembled from toolClassifier metadata
7. `index.html`:
   - Semantic HTML shell (header, aside, main)
   - Imports all CSS and main `app.js` as `type="module"`
   - Inline skeleton/loading state

### Phase 4 — Data & Deploy
8. Copy `dynamic_validator_results.json` → `data/sample.json`
9. Add GitHub Actions workflow (`.github/workflows/deploy.yml`) — on push to `main`,
   deploys the static files to GitHub Pages
10. Update this PLAN.md with completion status

---

## Verification Checklist

- [ ] Page loads, 48+ simulations appear in sidebar with task-type badges
- [ ] `urban_map_web_discovery_01`: tool calls show `text_search` → **🗺️ Map Tool** (blue), `read_place_website` → **🌐 Web Tool** (green)
- [ ] `urban_map_web_booking_01`: `book_place` → **🗄️ Database Tool** (purple)
- [ ] Any civic task: `submit_council_report` → **🗄️ Database Tool** (purple)
- [ ] JSON result sections collapse/expand on click
- [ ] Reward score breakdown visible in TaskInfoPanel
- [ ] File upload replaces loaded data correctly
- [ ] Works on mobile (sidebar overlay)
- [ ] `npm run build` is NOT required — page works served directly from GitHub Pages

---

## Relevant Source Files

| File | Role |
|---|---|
| `tau2-bench/scripts/urban_map_web/dynamic_validator_results.json` | Source data (copy to `data/sample.json`) |
| `tau2-bench/src/tau2/domains/urban_map_web/tools.py` | Tool definitions & ToolType classification |
| `tau2-bench/web/leaderboard/src/components/TrajectoryVisualizer.jsx` | Reference for conversation rendering patterns |
