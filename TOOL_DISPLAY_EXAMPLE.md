# Tool Call Display Example

## Input Data (from your JSON)

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [{
    "id": "call_XUmKRvu16isLCcxjjM8YfBpy",
    "name": "text_search",
    "arguments": {
      "query": "Flagstaff"
    }
  }],
  "turn_idx": 8
}

{
  "id": "call_XUmKRvu16isLCcxjjM8YfBpy",
  "role": "tool",
  "content": "[{\"id\": \"ChIJ8TlgJUpd1moRYOb0CXZWBB0\", \"displayName\": \"Flagstaff\", \"address\": \"Melbourne VIC 3000, Australia\", \"location\": {\"lat\": \"-37.812185400000004\", \"lng\": \"144.9564038\"}}]"
}
```

## How It Will Display in Conversation

### Visual Layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🗺️ MAP TOOL          text_search                 ID: call_XUmKR │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 📥 ARGUMENTS                                                     │
│ {                                                                │
│   "query": "Flagstaff"                                          │
│ }                                                                │
│                                                                   │
│ ─────────────────────────────────────────────────────────────    │
│                                                                   │
│ 📤 RESULT                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ id                         | displayName | address            │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ChIJ8TlgJUpd1moRYOb0CXZWBB │ Flagstaff   | Melbourne VIC...   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Display Features

### Tool Call Card (Outer Container)
- **Border-left**: 4px colored bar (blue for Map tools, green for Web, purple for Database, amber for Generic)
- **Header**: Shows tool group icon + group name, tool name, tool ID
- **Body**: Two sections - Arguments and Result

### Arguments Section (📥)
- Shows raw JSON of what parameters were passed to the tool
- Always visible and expanded
- Syntax-highlighted for readability (keys, values, strings colored)

### Result Section (📤)
- Shows the return value from the tool
- **Smart Formatting**:
  - **Arrays of objects** → Rendered as HTML table with columns
    - Example: text_search results show id, displayName, address, location in a clean table
  - **Single objects** → Special formatting:
    - place_details: Shows name, address, rating (⭐), opening hours, accessibility
    - book_place: Green success box with booking ID, date/time, party size
    - submit_council_report: Red success box with ticket ID, issue type, status
  - **Strings**: Rendered as readable text (for website content, error messages)
  - **Fallback**: Plain JSON if too complex

## Example Outputs

### text_search Result (Array → Table)
```
┌────────────────────────────────────────────────────────────┐
│ id                   | displayName | address      | ...    │
├────────────────────────────────────────────────────────────┤
│ ChIJ8TlgJUpd1mo...   | Flagstaff   | Melbourne... | ...    │
│ ChIJ_0F...           | Flagstaff HQ | Flagstaff... | ...    │
└────────────────────────────────────────────────────────────┘
```

### place_details Result (Object → Formatted Card)
```
┌─────────────────────────────────────────┐
│ Australia Post - Flagstaff              │
│ 📍 Level 1, 530 Collins St, Melbourne   │
│ 🧭 -37.8122, 144.9564                   │
│ ⭐ 4.5                                  │
│ Types: postal_service, bank             │
│ ♿ Access: wheelchair_accessible        │
│ 🕐 Hours: Mon-Fri 9am-5pm, Sat 9am-1pm │
└─────────────────────────────────────────┘
```

### book_place Result (Success Box)
```
┌──────────────────────────────────┐
│ ✓ Booking confirmed              │
│ ID: booking_ABC123DEF            │
│ Date/Time: 2026-04-05 19:30      │
│ Party: 4 people                  │
└──────────────────────────────────┘
```

## CSS Classes Used
- `.tool-call-card` - Main container (blue/green/purple/amber border-left)
- `.tool-header` - Header with group badge, tool name, ID
- `.tool-body` - Body containing Arguments and Result
- `.json-block` - Syntax-highlighted JSON box
- `table` - Auto-generated for array results
- Inline styles for special cases (booking, report, errors)

## JSON Syntax Highlighting
- **Keys** (dark color): `"query"`
- **String values** (green): `"Flagstaff"`
- **Numbers** (blue): `123`, `-37.812`
- **Booleans** (purple): `true`, `false`
- **Null** (cyan): `null`

## Responsive Behavior
- On mobile: Tool card wraps to full width
- Text in JSON blocks can scroll horizontally if too wide
- Table results truncate after 12 rows with "... and X more" message
- Max 7 columns shown in result tables

## Cost & Metadata Display
- Tool ID shown in header for debugging
- No separate cost display in tool card (shown in metrics panel instead)
- Timestamp not shown (available in message metadata)

---

## Summary

Your tool calls will now display beautifully:
1. **Tool Invocation** - Clear Arguments block showing exactly what was sent to the tool
2. **Tool Result** - Smart formatting showing results as tables, formatted objects, or readable text
3. **Visual Clarity** - Color-coded by tool group (Map=blue, Web=green, DB=purple, Generic=amber)
4. **User-Friendly** - No raw JSON walls, formatted for readability

This is exactly what you requested: "show tool call và result one cách dễ nhìn cho người dùng" ✓
