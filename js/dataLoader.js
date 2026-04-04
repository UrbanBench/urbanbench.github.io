// dataLoader.js
// Parses and indexes a dynamic_validator_results.json object.
//
// Returns:
//   {
//     meta: { timestamp, num_trials, llm_agent, llm_user, domain },
//     simulations: SimulationRecord[],        // sorted by task_id
//     tasksMap: { [task_id]: TaskRecord },
//   }
//
// SimulationRecord:
//   { id, task_id, taskType, taskMeta, reward, score, termination, duration, agentCost, userCost, messages, seed }
//
// TaskRecord: the raw task object from tasks[]

export function loadData(json) {
  const info = json.info ?? {};
  const domain = info.environment_info?.domain_name ?? 'unknown';
  const llmAgent = info.agent_info?.llm ?? '?';
  const llmUser = info.user_info?.llm ?? '?';

  // Build tasks map
  const tasksMap = {};
  for (const task of json.tasks ?? []) {
    tasksMap[task.id] = task;
  }

  // Build simulation records
  const simulations = (json.simulations ?? []).map(sim => {
    const taskMeta = tasksMap[sim.task_id] ?? null;
    const rewardInfo = sim.reward_info ?? {};

    return {
      id: sim.id,
      task_id: sim.task_id,
      taskType: deriveTaskType(sim.task_id),
      taskMeta,
      reward: rewardInfo,
      score: computeScore(rewardInfo),
      termination: sim.termination_reason ?? 'unknown',
      duration: sim.duration ?? 0,
      agentCost: sim.agent_cost ?? 0,
      userCost: sim.user_cost ?? 0,
      messages: sim.messages ?? [],
      seed: sim.seed,
      timestamp: sim.timestamp,
    };
  });

  // Sort by task_id alphabetically
  simulations.sort((a, b) => a.task_id.localeCompare(b.task_id));

  return {
    meta: {
      timestamp: json.timestamp,
      num_trials: info.num_trials,
      llm_agent: llmAgent,
      llm_user: llmUser,
      domain,
    },
    simulations,
    tasksMap,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TASK_TYPES = [
  'discovery', 'booking', 'en_route', 'civic', 'transit',
  'event_transit', 'spatial_filter', 'itinerary',
];

function deriveTaskType(taskId) {
  // e.g. "urban_map_web_en_route_01" → "en_route"
  for (const t of TASK_TYPES) {
    if (taskId.includes(t)) return t;
  }
  return 'other';
}

function computeScore(rewardInfo) {
  // Prefer pre-computed reward_breakdown average
  const breakdown = rewardInfo.reward_breakdown;
  if (breakdown && typeof breakdown === 'object') {
    const vals = Object.values(breakdown).filter(v => typeof v === 'number');
    if (vals.length > 0) {
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  // Fall back to action_results average
  const actions = rewardInfo.action_results ?? [];
  const rewards = actions.map(a => a.action_reward ?? 0).filter(v => typeof v === 'number');
  if (rewards.length > 0) {
    return rewards.reduce((a, b) => a + b, 0) / rewards.length;
  }

  return null; // no score available
}

// ── Utility: extract unique task types from simulation list ─────────────────
export function getTaskTypes(simulations) {
  return [...new Set(simulations.map(s => s.taskType))].sort();
}
