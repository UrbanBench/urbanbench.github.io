// messageParser.js
// Converts a raw messages[] array from the results JSON into an ordered list
// of structured turn objects ready for rendering.
//
// Output turn types:
//   {type:'agent_text',   content, turnIdx, cost}
//   {type:'user_text',    content, turnIdx, cost}
//   {type:'tool_call',    toolName, toolCallId, args, result, resultRaw, error, turnIdx, cost}
//   {type:'system',       content, turnIdx}

export function parseMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  // Build a quick lookup: toolCallId → tool-result message
  const toolResultById = {};
  for (const msg of messages) {
    if (msg.role === 'tool' && msg.id) {
      toolResultById[msg.id] = msg;
    }
  }

  const turns = [];
  const seenToolIds = new Set(); // avoid duplicating tool results as own turn

  for (const msg of messages) {
    // ── Skip orphan tool result messages (they're embedded in tool_call turns)
    if (msg.role === 'tool') continue;

    if (msg.role === 'user') {
      const text = extractText(msg.content);
      if (text) {
        turns.push({ type: 'user_text', content: text, turnIdx: msg.turn_idx ?? null, cost: msg.cost ?? 0 });
      }
      continue;
    }

    if (msg.role === 'system') {
      turns.push({ type: 'system', content: extractText(msg.content), turnIdx: msg.turn_idx ?? null });
      continue;
    }

    if (msg.role === 'assistant') {
      // Case 1: tool call(s)
      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (seenToolIds.has(tc.id)) continue;
          seenToolIds.add(tc.id);

          const resultMsg = toolResultById[tc.id] ?? null;
          let resultParsed = null;
          let resultRaw = null;
          let error = false;

          if (resultMsg) {
            resultRaw = resultMsg.content ?? '';
            error = resultMsg.error === true;
            resultParsed = tryParseJSON(resultRaw);
          }

          turns.push({
            type: 'tool_call',
            toolName: tc.name,
            toolCallId: tc.id,
            args: tc.arguments ?? {},
            result: resultParsed,
            resultRaw: resultRaw,
            error,
            turnIdx: msg.turn_idx ?? null,
            cost: msg.cost ?? 0,
          });
        }
        continue;
      }

      // Case 2: text content
      const text = extractText(msg.content);
      if (text) {
        turns.push({ type: 'agent_text', content: text, turnIdx: msg.turn_idx ?? null, cost: msg.cost ?? 0 });
      }
    }
  }

  return turns;
}

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }
  return String(content);
}

function tryParseJSON(str) {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return null; // will fall back to raw string
  }
}
