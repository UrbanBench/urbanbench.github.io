// benchmarkMetrics.js
// Computes action_score and nl_accuracy based on benchmark.py logic

/**
 * Extracts scores from pre-computed reward_info in the simulation.
 */
export function computeSimulationMetrics(sim, task) {
  if (!sim) return { actionScore: null, nlAccuracy: null, actionResults: [], nlResults: [] };

  const rewardInfo = sim.reward ?? sim.reward_info ?? {};

  // ── Compute action score ──────────────────────────────────────────────────
  const actionChecks = rewardInfo.action_checks ?? rewardInfo.action_results ?? [];

  let actionScore = null;
  const actionResults = [];
  
  if (actionChecks.length > 0) {
    let metCount = 0;
    for (const check of actionChecks) {
      const met = check.action_match === true || check.action_reward === 1.0 || check.met === true;
      if (met) metCount++;
      actionResults.push({
        action: check.action,
        met: met
      });
    }
    actionScore = metCount / actionChecks.length;
  }

  // ── Compute NL accuracy ───────────────────────────────────────────────────
  const actualNL = rewardInfo.nl_assertions ?? [];

  let nlAccuracy = null;
  if (actualNL.length > 0) {
    const metCount = actualNL.filter(a => a.met === true).length;
    nlAccuracy = metCount / actualNL.length;
  }

  return { actionScore, nlAccuracy, actionResults, nlResults: actualNL };
}
