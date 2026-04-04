// resultFormatter.js
// Formats tool results for friendly display in conversations

/**
 * Takes parsed tool result (JSON object/array/string) and returns:
 * { type: 'table'|'list'|'text'|'object', html: '...' }
 */
export function formatToolResult(result, toolName) {
  if (!result) return { type: 'text', html: '<em>No result</em>' };

  // String (e.g., website content, error message)
  if (typeof result === 'string') {
    return formatText(result);
  }

  // Array (e.g., places, events, transit schedules, [])
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return { type: 'text', html: '<em>Empty result</em>' };
    }

    // Homogeneous array of similar objects → table
    if (typeof result[0] === 'object' && result[0] !== null) {
      return formatArrayAsTable(result, toolName);
    }

    // Array of scalars → list
    return formatList(result);
  }

  // Single object (place_details, booking result, etc.)
  if (typeof result === 'object') {
    return formatObject(result, toolName);
  }

  // Fallback
  return {
    type: 'text',
    html: `<pre>${escapeHtml(String(result))}</pre>`,
  };
}

function formatText(text) {
  if (!text) return { type: 'text', html: '<em>Empty</em>' };

  // If it's very long, truncate and show collapsed
  const isLong = text.length > 500;

  // Sanitize but preserve structure
  let html = escapeHtml(text);

  // Light markdown: bold, headings, lists
  html = html.replace(/^#+\s+(.+)$/gm, '<strong>$1</strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\s*-\s+(.+)$/gm, '<div style="margin-left:16px">• $1</div>');

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map(p => p.trim() ? `<p style="margin-bottom:6px">${p}</p>` : '')
    .join('');

  if (isLong) {
    return {
      type: 'text-collapsible',
      html: `<details style="margin:  4px 0"><summary style="cursor:pointer;color:var(--text-secondary);font-size:11px"><strong>📄 Website content (${text.length} chars)</strong></summary><div style="margin-top:8px;padding:8px;background:var(--surface-1);border-radius:4px;font-size:11px;line-height:1.5;max-height:300px;overflow-y:auto">${html}</div></details>`,
    };
  }

  return { type: 'text', html };
}

function formatList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { type: 'text', html: '<em>Empty</em>' };
  }

  const items = arr
    .slice(0, 10) // limit to 10 for display
    .map(item => {
      const text = typeof item === 'object' ? JSON.stringify(item) : escapeHtml(String(item));
      return `<li style="margin-bottom:4px">${text}</li>`;
    })
    .join('');

  const more = arr.length > 10 ? `<li style="color:var(--text-muted);font-style:italic">… and ${arr.length - 10} more</li>` : '';

  return {
    type: 'list',
    html: `<ul style="margin:0;padding-left:18px">${items}${more}</ul>`,
  };
}

function formatArrayAsTable(arr, toolName) {
  if (arr.length === 0) return { type: 'text', html: '<em>Empty</em>' };

  // Infer columns from first few items
  const keys = inferColumns(arr);
  const rows = arr.slice(0, 12); // limit rows shown

  // Render table
  const headerRow = keys.map(k => `<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border-light);font-weight:600;font-size:10px">${escapeHtml(String(k))}</th>`).join('');

  const bodyRows = rows
    .map(item => {
      const cells = keys
        .map(k => {
          const val = item[k];
          let cellText = formatCellValue(val);
          return `<td style="padding:6px 8px;border-bottom:1px solid var(--border-light);font-size:11px;color:var(--text-secondary)">${cellText}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const moreRows = arr.length > rows.length
    ? `<tr><td colspan="${keys.length}" style="padding:8px;text-align:center;color:var(--text-muted);font-size:10px">… and ${arr.length - rows.length} more</td></tr>`
    : '';

  const html = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin:4px 0">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}${moreRows}</tbody>
    </table>
  `;

  return { type: 'table', html };
}

function formatObject(obj, toolName) {
  if (!obj || Object.keys(obj).length === 0) {
    return { type: 'text', html: '<em>Empty object</em>' };
  }

  // Special handling for place_details
  if (toolName === 'place_details' && obj.name) {
    return formatPlaceDetails(obj);
  }

  // Special handling for booking confirmations
  if (toolName === 'book_place' && obj.booking_id) {
    return formatBooking(obj);
  }

  // Special handling for report submissions
  if (toolName === 'submit_council_report' && obj.ticket_id) {
    return formatReport(obj);
  }

  // Generic object display
  const pairs = Object.entries(obj)
    .slice(0, 20)
    .map(([k, v]) => {
      const val = formatCellValue(v);
      return `<div style="margin-bottom:6px"><span style="font-weight:600;color:var(--text-secondary)">${escapeHtml(String(k))}:</span> ${val}</div>`;
    })
    .join('');

  return { type: 'object', html: pairs };
}

function formatPlaceDetails(place) {
  const { name, address, rating, location, types, accessibility, opening_hours } = place;

  const html = `
    <div style="padding:8px 0">
      <div style="margin-bottom:6px">
        <strong style="font-size:12px">${escapeHtml(name ?? '–')}</strong>
      </div>
      ${address ? `<div style="margin-bottom:4px;color:var(--text-secondary);font-size:11px">📍 ${escapeHtml(address)}</div>` : ''}
      ${location ? `<div style="margin-bottom:4px;color:var(--text-secondary);font-size:11px">🧭 ${location.lat}, ${location.lng}</div>` : ''}
      ${rating ? `<div style="margin-bottom:4px"><span style="background:#fbbf24;color:#78350f;padding:2px 6px;border-radius:12px;font-size:10px;font-weight:600">⭐ ${rating}</span></div>` : ''}
      ${types && types.length ? `<div style="margin-bottom:4px;font-size:11px"><strong>Types:</strong> ${escapeHtml(types.join(', '))}</div>` : ''}
      ${accessibility && Object.keys(accessibility).length ? `<div style="margin-bottom:4px;font-size:11px"><strong>♿ Access:</strong> ${formatAccessibility(accessibility)}</div>` : ''}
      ${opening_hours ? `<div style="margin-bottom:4px;font-size:11px"><strong>🕐 Hours:</strong> ${formatOpeningHours(opening_hours)}</div>` : ''}
    </div>
  `;

  return { type: 'object', html };
}

function formatBooking(booking) {
  const { booking_id, place_id, datetime_str, party_size } = booking;

  const html = `
    <div style="padding:8px;background:#f0fdf4;border-radius:6px;border:1px solid #86efac">
      <div style="color:#15803d;font-weight:600;margin-bottom:4px">✓ Booking confirmed</div>
      <table style="font-size:11px;width:100%">
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>ID:</strong></td><td style="font-family:monospace">${escapeHtml(booking_id)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>Date/Time:</strong></td><td>${escapeHtml(datetime_str)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>Party:</strong></td><td>${party_size} people</td></tr>
      </table>
    </div>
  `;

  return { type: 'object', html };
}

function formatReport(report) {
  const { ticket_id, issue_type, status } = report;

  const html = `
    <div style="padding:8px;background:#fef2f2;border-radius:6px;border:1px solid #fca5a5">
      <div style="color:#dc2626;font-weight:600;margin-bottom:4px">✓ Report submitted</div>
      <table style="font-size:11px;width:100%">
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>Ticket:</strong></td><td style="font-family:monospace;color:#7c3aed;font-weight:700">${escapeHtml(ticket_id)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>Issue:</strong></td><td>${escapeHtml(issue_type)}</td></tr>
        <tr><td style="color:var(--text-muted);padding:2px 0"><strong>Status:</strong></td><td>${escapeHtml(status ?? 'Submitted')}</td></tr>
      </table>
    </div>
  `;

  return { type: 'object', html };
}

function formatAccessibility(acc) {
  return Object.entries(acc)
    .filter(([, v]) => v === true)
    .map(([k]) => escapeHtml(k))
    .join(', ');
}

function formatOpeningHours(hours) {
  if (typeof hours === 'string') return escapeHtml(hours);
  return '(see details)';
}

function formatCellValue(val) {
  if (val === null || val === undefined) {
    return '<span style="color:var(--text-muted)">–</span>';
  }

  if (typeof val === 'boolean') {
    return val ? '<span style="color:#16a34a">✓</span>' : '<span style="color:#dc2626">✗</span>';
  }

  if (typeof val === 'number') {
    // Format coordinates, distances, ratings
    if (Math.abs(val) < 0.001) return '0';
    if (Math.abs(val) < -30 || val > 150) return val.toFixed(0); // might be lat/lng
    return val.toFixed(2);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '–';
    if (typeof val[0] === 'string') {
      return escapeHtml(val.slice(0, 2).join(', ') + (val.length > 2 ? '...' : ''));
    }
    return `[${val.length} items]`;
  }

  if (typeof val === 'object') {
    return '[object]';
  }

  return escapeHtml(String(val).substring(0, 100));
}

function inferColumns(arr) {
  // Collect all keys from all objects, preserve order
  const keys = [];
  const seen = new Set();

  // Priority: id, name, displayName, address, location, distance (for places)
  const priority = ['id', 'place_id', 'name', 'displayName', 'address', 'location', 'distance_meters', 'lat', 'lng', 'rating'];

  for (const item of arr) {
    if (typeof item === 'object' && item !== null) {
      for (const k of Object.keys(item)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
  }

  // Reorder: priority first, then others
  const withPriority = [];
  const remaining = [];

  for (const k of keys) {
    if (priority.includes(k)) {
      withPriority.push(k);
    } else {
      remaining.push(k);
    }
  }

  return [...withPriority, ...remaining].slice(0, 7); // max 7 columns
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
