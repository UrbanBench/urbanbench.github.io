# UrbanBench — Conversation Viewer

A zero-dependency static web app that visualises agent–user conversation
simulations from the **Urban-Map-Web** benchmark.

Live: <https://urbanbench.github.io>

---

## Features

- **Conversation view** — full chat thread with user bubbles (right) and agent bubbles (left)
- **Tool call cards** — every tool invocation is rendered as a card showing:
  - Group badge + icon: 🗺️ **Map Tool** · 🌐 **Web Tool** · 🗄️ **Database Tool** · ⚙️ **Generic Tool**
  - Tool name and arguments (collapsible JSON with syntax highlighting)
  - Tool result (collapsible, error-highlighted on failure)
- **Evaluation panel** — per-task reward breakdown, action step pass/fail, NL assertion outcomes
- **Sidebar** — filter by task type, score chip, termination badge, cost/duration
- **File upload** — load any `dynamic_validator_results.json` via drag-drop or file picker
- **Zero build step** — pure HTML + CSS + ES Modules, served directly by GitHub Pages

---

## Tool Group Classification

| Group | Icon | Tools |
|---|---|---|
| Map Tool | 🗺️ | `text_search`, `place_details`, `nearby_search`, `compute_routes`, `search_along_route` |
| Web Tool | 🌐 | `read_place_website`, `get_transit_schedule`, `search_venue_events`, `check_availability` |
| Database Tool | 🗄️ | `book_place`, `submit_council_report` |
| Generic Tool | ⚙️ | `transfer_to_human_agents` |

---

## Local Development

This is a plain static site. Any HTTP server works:

```bash
# Python (built-in)
cd urbanbench.github.io
python -m http.server 8080

# Node (if available)
npx serve .
```

Then open <http://localhost:8080>.

> **Note:** Opening `index.html` directly via `file://` won't work because browsers
> block `fetch()` on the `file://` protocol. Use an HTTP server instead.
> You can still upload a JSON file manually via the **Load JSON** button.

---

## Adding / Updating Sample Data

```bash
cp path/to/dynamic_validator_results.json data/sample.json
```

The page auto-fetches `data/sample.json` on load. You can also load any compatible
JSON file at runtime via the **Load JSON** button.

---

## Deployment

Push to `main` — GitHub Actions (`.github/workflows/deploy.yml`) will automatically
deploy the site to GitHub Pages. No build step needed.

---

## Input Format

The viewer accepts the `dynamic_validator_results.json` format produced by
`tau2-bench`'s `dynamic_validator.py`. Key fields used:

```json
{
  "info": { "agent_info": { "llm": "..." }, "user_info": { "llm": "..." } },
  "tasks": [ { "id": "...", "description": {}, "evaluation_criteria": {} } ],
  "simulations": [
    {
      "task_id": "...",
      "termination_reason": "user_stop",
      "reward_info": { "reward_breakdown": {}, "action_results": [], "nl_assertions": [] },
      "messages": [
        { "role": "user|assistant|tool", "content": "...", "tool_calls": [...] }
      ]
    }
  ]
}
```
