# UrbanBench — Conversation Viewer

A zero-dependency static web app that visualises agent–user conversation
simulations from the **UrbanBench** benchmark, supporting multiple urban
reasoning domains.

Live: <https://urbanbench.github.io>

---

## Domains

### 🗺️ Urban-Map-Web
Agent navigates real-world urban locations using map search, place details,
route planning, and booking APIs to fulfil complex multi-step user requests.

### 🛰️ Urban-Satellite
Agent analyzes satellite imagery using VLM-powered perception tools to
classify land use, detect infrastructure, assess urban density, measure
spatial distances, and submit formal site assessments.

---

## Features

- **Landing page** — domain selection page routing to each viewer and leaderboard
- **Global Leaderboard** — Aggregated metric scores (Pass^1, Efficiency, Process/Outcome Accuracy) dynamic per model
- **Dynamic Model Selection** — Seamlessly switch back and forth traversing different trajectories natively (loaded directly from folders like `gpt-4.1-mini.json`, `qwen3-32b.json`...)
- **Conversation view** — full chat thread with user bubbles and agent bubbles
- **Tool call cards** — every tool invocation is rendered as a card showing:
  - 🛰️ **Satellite image preview** — for Urban-Satellite tools that accept an `image_path` argument, the referenced satellite tile is rendered inline in the tool card (current and historical images)
- **Evaluation panel** — per-task reward breakdown, action step pass/fail, NL assertion outcomes
- **Zero build step** — pure HTML + CSS + ES Modules, served directly by GitHub Pages

---

## Tool Group Classification

### Urban-Map-Web

| Group | Icon | Tools |
|---|---|---|
| Map Tool | 🗺️ | `text_search`, `place_details`, `nearby_search`, `compute_routes`, `search_along_route` |
| Web Tool | 🌐 | `read_place_website`, `get_transit_schedule`, `search_venue_events`, `check_availability` |
| Database Tool | 🗄️ | `book_place`, `submit_council_report` |
| Generic Tool | ⚙️ | `transfer_to_human_agents` |

### Urban-Satellite

| Group | Icon | Tools |
|---|---|---|
| Spatial Retrieval | 🛰️ | `get_satellite_tile`, `get_past_satellite_tile`, `measure_spatial_distance` |
| VLM Perception | 🔭 | `classify_land_use`, `analyze_urban_density`, `check_environmental_ratio`, `estimate_carbon_emission`, `detect_infrastructure`, `verify_path_connectivity`, `compare_temporal_change` |
| Database Write | 📋 | `submit_site_assessment` |
| Generic Tool | 🤝 | `transfer_to_human` |

---

## Project Structure

```
urbanbench.github.io/
├── index.html                  # Landing page — choose domain
├── urban-map-web.html          # Urban-Map-Web conversation viewer
├── urban-satellite.html        # Urban-Satellite conversation viewer
├── css/
│   ├── theme.css               # Design tokens, base styles
│   ├── components.css          # Viewer UI components
│   └── landing.css             # Landing page styles
├── js/
│   ├── app.js                  # Urban-Map-Web viewer logic
│   ├── satelliteApp.js         # Urban-Satellite viewer logic (image-aware)
│   ├── dataLoader.js           # JSON parsing & indexing (shared)
│   ├── messageParser.js        # Conversation message parser (shared)
│   ├── toolClassifier.js       # Tool → icon/color metadata (all domains)
│   ├── resultFormatter.js      # Tool result → HTML formatter (all domains)
│   └── benchmarkMetrics.js     # Accuracy metric computation (shared)
├── metrics/
│   └── calculate_leaderboard.py# Score aggregator & Leaderboard JSON generator
├── data/
│   ├── leaderboard/            # dynamic leaderboard JSON mapping
│   ├── urban_map_web/          # Multiple simulation items (e.g. gpt-4.1-mini.json, claude-sonnet-4.6.json)
│   └── urban_satellite/        # Multiple simulation items
└── assets/
    ├── satellite_imgs/         # Current satellite tile PNGs (500 files)
    └── satellite_imgs_past/    # Historical satellite tile PNGs (100 files)
```

---

## Local Development

This is a plain static site. Any HTTP server works:

```bash
# Python (built-in)
cd urbanbench.github.io
python -m http.server 8088

# Node (if available)
npx serve .
```

Then open <http://localhost:8088>.

> **Note:** Opening `index.html` directly via `file://` won't work because browsers
> block `fetch()` on the `file://` protocol. Use an HTTP server instead.
> You can still upload a JSON file manually via the **Load JSON** button.

---

## Adding / Updating Models Data & Leaderboard

Because the viewer supports multiple agents concurrently parsing various scores, the process involves standardizing models inside directories and automatically generating the UI mapping:

1. **Dump JSON Result Data:**
```bash
# Place your new model's results (e.g. gpt-5.json) into its domain directory:
cp path/to/results.json data/urban_map_web/gpt-5.json

# Or for Urban-Satellite:
cp path/to/satellite_results.json data/urban_satellite/gpt-5.json
```

2. **Calculate \& Update Display Dashboard:**
```bash
# Execute the python evaluator
python3 metrics/calculate_leaderboard.py --action_threshold 0.8 --nl_threshold 0.6
```
*This scans both `data/urban_map_web/` and `data/urban_satellite/` for raw scores, updates conditional efficiency tracking, writes `data/leaderboard/leaderboard.json`, and seamlessly updates BOTH the online Leaderboard component and the Model Dropdown Viewer dynamically on the UI.*

### Updating Satellite Images

```bash
# Copy current tiles
cp /path/to/satellite_imgs/*.png assets/satellite_imgs/

# Copy historical tiles
cp /path/to/satellite_imgs_past/*.png assets/satellite_imgs_past/
```

Images are referenced by filename from the `image_path` argument in tool calls
(e.g., `"19652_30145.png"` → `assets/satellite_imgs/19652_30145.png`,
`"19652_30145_past.png"` → `assets/satellite_imgs_past/19652_30145_past.png`).

---

## Deployment

Push to `main` — GitHub Actions (`.github/workflows/deploy.yml`) will automatically
deploy the site to GitHub Pages. No build step needed.

---

## Input Format

The viewer accepts the simulation JSON format produced by `tau2-bench`'s
`dynamic_validator.py`. Key fields used:

```json
{
  "info": {
    "agent_info": { "llm": "..." },
    "user_info":  { "llm": "..." },
    "environment_info": { "domain_name": "urban_map_web | urban_satellite" }
  },
  "tasks": [
    {
      "id": "...",
      "description": { "purpose": "..." },
      "user_scenario": { "persona": "...", "instructions": {} },
      "evaluation_criteria": {
        "actions": [],
        "nl_assertions": []
      }
    }
  ],
  "simulations": [
    {
      "task_id": "...",
      "termination_reason": "user_stop",
      "reward_info": {
        "reward": 0.0,
        "reward_breakdown": {},
        "action_checks": [],
        "nl_assertions": []
      },
      "messages": [
        { "role": "user|assistant|tool", "content": "...", "tool_calls": [...] }
      ]
    }
  ]
}
```
