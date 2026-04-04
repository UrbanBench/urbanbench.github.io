// toolClassifier.js
// Maps tool names → group metadata (icon, color, label)

const TOOL_META = {
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

  // ── Generic Operations ─────────────────────────────────────────────────
  transfer_to_human_agents: {
    group: 'Generic Tool',
    icon: '⚙️',
    color: '#d97706',
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
