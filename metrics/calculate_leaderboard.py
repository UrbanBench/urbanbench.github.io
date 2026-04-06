import argparse
import json
import os
import glob

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
OUTPUT_DIR = os.path.join(DATA_DIR, 'leaderboard')

BYPASS_ARGUMENTS = {"query", "description", "summary", "image_path"}

def recorrect_simulation_actions(data):
    """
    Update action_match based on recorrect rule.
    If tool name is correct and contains bypassable arguments, mark as match.
    """
    tasks = data.get('tasks', [])
    # Build per-task action_id -> name map to avoid cross-task action_id collisions
    # (different tasks reuse the same action_id strings like "a1", "a2", etc.)
    task_action_id_to_name = {}
    for task in tasks:
        task_id = task.get('id')
        if not task_id:
            continue
        task_map = {}
        for action in task.get('evaluation_criteria', {}).get('actions', []):
            action_id = action.get('action_id')
            if action_id:
                task_map[action_id] = action.get('name')
        task_action_id_to_name[task_id] = task_map

    simulations = data.get('simulations', [])
    updated = 0
    
    for sim in simulations:
        # Use the task-specific action_id map for this simulation
        action_id_to_name = task_action_id_to_name.get(sim.get('task_id'), {})

        reward_info = sim.get('reward_info')
        if not isinstance(reward_info, dict):
            reward_candidate = sim.get('reward')
            if isinstance(reward_candidate, dict):
                reward_info = reward_candidate
            else:
                continue
            
        checks = reward_info.get('action_checks') or reward_info.get('action_results') or []
        for check in checks:
            action_obj = check.get('action', {})
            action_id = action_obj.get('action_id')
            if not action_id:
                continue
                
            expected_name = action_id_to_name.get(action_id)
            actual_name = action_obj.get('name')
            actual_args = action_obj.get('arguments', {})
            
            # Rule: If name matches and contains bypassable args, it's a pass
            if actual_name == expected_name:
                has_bypass_arg = any(arg in actual_args for arg in BYPASS_ARGUMENTS)
                if has_bypass_arg:
                    if check.get('action_match') is not True:
                        check['action_match'] = True
                        check['action_reward'] = 1.0
                        updated += 1
    return updated

def compute_action_score(reward_info):
    checks = reward_info.get('action_checks') or reward_info.get('action_results') or []
    if not checks:
        return 0.0
    met_count = 0
    for c in checks:
        if c.get('action_match') is True or c.get('action_reward') == 1.0 or c.get('met') is True:
            met_count += 1
    return float(met_count) / len(checks)

def compute_nl_accuracy(reward_info):
    assertions = reward_info.get('nl_assertions') or []
    if not assertions:
        return 0.0
    met_count = sum(1 for a in assertions if a.get('met') is True)
    return float(met_count) / len(assertions)

def calculate_manual_reward(action_accuracy, nl_accuracy, action_threshold=0.8, nl_threshold=0.8):
    """
    Manually determine if a task is successful based on custom thresholds.
    Default: Success if both action and NL accuracy are > 80% (inclusive)
    """
    return (action_accuracy >= action_threshold) and (nl_accuracy >= nl_threshold)

def compute_turn_act(messages):
    act = 0
    for msg in messages:
        if msg.get('role') == 'assistant':
            if not msg.get('tool_calls') and msg.get('content'):
                act += 1
    return max(1, act)  # Ensure non-zero to avoid div/0

def get_recorrected_filename(source_path):
    stem, ext = os.path.splitext(os.path.basename(source_path))
    return f"{stem}_recorrected{ext}"


def process_domain(domain_slug, action_threshold=0.8, nl_threshold=0.8):
    domain_path = os.path.join(DATA_DIR, domain_slug)
    json_files = sorted(
        p for p in glob.glob(os.path.join(domain_path, '*.json'))
        if not p.endswith('_recorrected.json')
    )
    
    results = []
    
    for jpath in json_files:
        try:
            with open(jpath, 'r') as f:
                data = json.load(f)
            recorrected_checks = recorrect_simulation_actions(data)
            if recorrected_checks > 0:
                print(f"Recorrected {recorrected_checks} checks: {jpath}")
        except Exception as e:
            print(f"Error loading {jpath}: {e}")
            continue
        
        info = data.get('info', {})
        agent_info = info.get('agent_info', {})
        model_name = agent_info.get('llm', os.path.basename(jpath).replace('.json', ''))
        
        tasks_map = {t['id']: t for t in data.get('tasks', [])}
        simulations = data.get('simulations', [])
        
        total_action_score = 0
        total_nl_accuracy = 0
        pass_count = 0
        ce_sum = 0
        overwritten_rewards = 0
        
        for sim in simulations:
            task_id = sim.get('task_id')
            reward_info = sim.get('reward_info')
            if not isinstance(reward_info, dict):
                reward_candidate = sim.get('reward')
                if isinstance(reward_candidate, dict):
                    reward_info = reward_candidate
                else:
                    reward_info = {}
                sim['reward_info'] = reward_info
                
            action_score = compute_action_score(reward_info)
            nl_accuracy = compute_nl_accuracy(reward_info)
            
            total_action_score += action_score
            total_nl_accuracy += nl_accuracy
            
            # Pass decision is always computed from current action/nl metrics.
            is_success = calculate_manual_reward(action_score, nl_accuracy, action_threshold, nl_threshold)

            passk_reward = 1.0 if is_success else 0.0
            if sim.get('reward') != passk_reward:
                overwritten_rewards += 1
            sim['reward'] = passk_reward
            reward_info['reward'] = passk_reward
            
            if is_success:
                pass_count += 1
                
                # Compute conditional efficiency
                task = tasks_map.get(task_id, {})
                instruction = task.get('user_scenario', {}).get('instructions', {}).get('reason_for_call', '')
                turn_opt = max(1, instruction.count('Step'))
                turn_act = compute_turn_act(sim.get('messages', []))
                
                ce_sum += (float(turn_opt) / float(turn_act))
        
        num_sims = len(simulations)
        if num_sims > 0:
            avg_action_score = total_action_score / num_sims
            avg_nl_accuracy = total_nl_accuracy / num_sims
            pass1 = float(pass_count) / num_sims
            ce_avg = ce_sum / pass_count if pass_count > 0 else 0.0
            pass1_eff = pass1 * ce_avg
        else:
            avg_action_score = avg_nl_accuracy = pass1 = pass1_eff = 0.0

        recorrected_filename = get_recorrected_filename(jpath)
        recorrected_path = os.path.join(domain_path, recorrected_filename)
        with open(recorrected_path, 'w') as wf:
            json.dump(data, wf, indent=2)

        if overwritten_rewards > 0:
            print(f"Overwrote reward for {overwritten_rewards} simulations: {recorrected_path}")

        results.append({
            "model_name": model_name,
            "filename": os.path.basename(jpath),
            "data_file": recorrected_filename,
            "average_process_accuracy": avg_action_score,
            "average_outcome_accuracy": avg_nl_accuracy,
            "pass1": pass1,
            "pass1_eff": pass1_eff
        })
        
    # Sort results by pass1_eff descending by default
    results.sort(key=lambda x: x['pass1_eff'], reverse=True)
    return results

def main():
    parser = argparse.ArgumentParser(description='Calculate leaderboard metrics')
    parser.add_argument('--action_threshold', type=float, default=0.8, help='Threshold for action accuracy (default: 0.8)')
    parser.add_argument('--nl_threshold', type=float, default=0.8, help='Threshold for NL accuracy (default: 0.8)')
    args = parser.parse_args()

    domains = ['urban_map_web', 'urban_satellite']
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    leaderboard_data = {}
    
    for domain in domains:
        print(
            f"Processing domain: {domain} (recorrect_action=default, "
            f"action_threshold={args.action_threshold}, nl_threshold={args.nl_threshold})"
        )
        leaderboard_data[domain] = process_domain(
            domain, 
            action_threshold=args.action_threshold,
            nl_threshold=args.nl_threshold
        )
        
    out_path = os.path.join(OUTPUT_DIR, 'leaderboard.json')
    with open(out_path, 'w') as f:
        json.dump(leaderboard_data, f, indent=2)
        
    print(f"Leaderboard data written to {out_path}")

if __name__ == '__main__':
    main()
