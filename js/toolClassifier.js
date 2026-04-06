// toolClassifier.js
// Maps tool names → group metadata (icon, color, label)
// Covers both Urban-Map-Web and Urban-Satellite domain tools.

const TOOL_META = {
  // ════════════════════════════════════════════════════════════
  //  URBAN-MAP-WEB DOMAIN TOOLS
  // ════════════════════════════════════════════════════════════

  // ── Spatial & Navigation (Map APIs) ────────────────────────────────────
  text_search: {
    group: 'Map Tool',
    icon: '🗺️',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    badge: 'map',
  },
  place_details: {
    group: 'Map Tool',
    icon: '📍',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    badge: 'map',
  },
  nearby_search: {
    group: 'Map Tool',
    icon: '🔍',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    badge: 'map',
  },
  compute_routes: {
    group: 'Map Tool',
    icon: '🛣️',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    badge: 'map',
  },
  search_along_route: {
    group: 'Map Tool',
    icon: '📡',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#93c5fd',
    badge: 'map',
  },

  // ── Unstructured Data Retrieval (Web APIs) ─────────────────────────────
  read_place_website: {
    group: 'Web Tool',
    icon: '🌐',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    badge: 'web',
  },
  get_transit_schedule: {
    group: 'Web Tool',
    icon: '🚊',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    badge: 'web',
  },
  search_venue_events: {
    group: 'Web Tool',
    icon: '🎭',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    badge: 'web',
  },
  check_availability: {
    group: 'Web Tool',
    icon: '📅',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    badge: 'web',
  },

  // ── Transactional / State-Mutating (Database APIs) ─────────────────────
  book_place: {
    group: 'Database Tool',
    icon: '🗄️',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    badge: 'db',
  },
  submit_council_report: {
    group: 'Database Tool',
    icon: '📋',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd',
    badge: 'db',
  },

  // ── Generic Operations (Map-Web) ───────────────────────────────────────
  transfer_to_human_agents: {
    group: 'Generic Tool',
    icon: '⚙️',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
    badge: 'generic',
  },

  // ════════════════════════════════════════════════════════════
  //  URBAN-SATELLITE DOMAIN TOOLS
  // ════════════════════════════════════════════════════════════

  // ── Data Retrieval & Spatial Operations (Read-only) ────────────────────
  get_satellite_tile: {
    group: 'Spatial Retrieval',
    icon: '🛰️',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    border: '#7dd3fc',
    badge: 'spatial',
  },
  get_past_satellite_tile: {
    group: 'Spatial Retrieval',
    icon: '📡',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    border: '#7dd3fc',
    badge: 'spatial',
  },
  measure_spatial_distance: {
    group: 'Spatial Retrieval',
    icon: '📐',
    color: '#0ea5e9',
    bg: '#f0f9ff',
    border: '#7dd3fc',
    badge: 'spatial',
  },

  // ── Zero-shot Visual Perception (VLM APIs) — Read-only ─────────────────
  classify_land_use: {
    group: 'VLM Perception',
    icon: '🏙️',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  analyze_urban_density: {
    group: 'VLM Perception',
    icon: '📊',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  check_environmental_ratio: {
    group: 'VLM Perception',
    icon: '🌿',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  estimate_carbon_emission: {
    group: 'VLM Perception',
    icon: '💨',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  detect_infrastructure: {
    group: 'VLM Perception',
    icon: '🔭',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  verify_path_connectivity: {
    group: 'VLM Perception',
    icon: '🔗',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },
  compare_temporal_change: {
    group: 'VLM Perception',
    icon: '⏱️',
    color: '#10b981',
    bg: '#f0fdf4',
    border: '#6ee7b7',
    badge: 'vlm',
  },

  // ── Transactional & State-Mutating (Database APIs) — Write ────────────
  submit_site_assessment: {
    group: 'Database Write',
    icon: '📋',
    color: '#8b5cf6',
    bg: '#faf5ff',
    border: '#c4b5fd',
    badge: 'satellite-db',
  },

  // ── Generic Operations (Satellite) ────────────────────────────────────
  transfer_to_human: {
    group: 'Generic Tool',
    icon: '🤝',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    badge: 'generic',
  },
};

const FALLBACK_META = {
  group: 'Tool',
  icon: '🔧',
  color: '#6b7280',
  bg: '#f9fafb',
  border: '#d1d5db',
  badge: 'generic',
};

export function getToolMeta(toolName) {
  return TOOL_META[toolName] ?? { ...FALLBACK_META, group: toolName };
}

export function getAllGroups() {
  const seen = new Set();
  const groups = [];
  for (const meta of Object.values(TOOL_META)) {
    if (!seen.has(meta.badge)) {
      seen.add(meta.badge);
      groups.push({ badge: meta.badge, group: meta.group, icon: meta.icon, color: meta.color });
    }
  }
  return groups;
}

