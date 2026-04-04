// benchmarkMetrics.js
// Computes action_score and nl_accuracy based on benchmark.py logic

/**
 * Parse expected actions from task evaluation_criteria and actual tool calls from messages.
 * Returns { actionScore: 0..1, nlAccuracy: 0..1, debug: {...} }
 */
export function computeSimulationMetrics(sim, task) {
  if (!sim || !task) return { actionScore: null, nlAccuracy: null };

  const criteria = task.evaluation_criteria ?? {};
  const rewardInfo = sim.reward_info ?? {};
  const messages = sim.messages ?? [];

  // ── Compute action score ──────────────────────────────────────────────────
  const expectedActions = criteria.actions ?? [];
  const actualCalls = extractToolCalls(messages);

  let actionScore = null;
  if (expectedActions.length > 0) {
    const actionScores = computeActionScores(expectedActions, actualCalls);
    actionScore = actionScores.length > 0
      ? actionScores.reduce((a, b) => a + b, 0) / actionScores.length
      : 0;
  }

  // ── Compute NL accuracy ───────────────────────────────────────────────────
  const expectedNL = criteria.nl_assertions ?? [];
  const actualNL = rewardInfo.nl_assertions ?? [];

  let nlAccuracy = null;
  if (expectedNL.length > 0 || actualNL.length > 0) {
    const metCount = actualNL.filter(a => a.met === true).length;
    nlAccuracy = actualNL.length > 0
      ? metCount / actualNL.length
      : 0;
  }

  return { actionScore, nlAccuracy };
}

function extractToolCalls(messages) {
  const calls = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        calls.push({
          name: tc.name,
          arguments: tc.arguments ?? {},
        });
      }
    }
  }
  return calls;
}

function computeActionScores(expectedActions, actualCalls) {
  // For simplicity, match by tool name in order (first occurrence)
  // This matches the spirit of benchmark.py's "name-only" tool matching
  const remaining = Array.from(actualCalls);
  const scores = [];

  for (const expAction of expectedActions) {
    const expName = expAction.action?.name ?? expAction.name;
    const idx = remaining.findIndex(c => c.name === expName);
    if (idx >= 0) {
      remaining.splice(idx, 1);
      scores.push(1.0);
    } else {
      scores.push(0.0);
    }
  }

  return scores;
}
