import argparse
import json
import os
import glob
from collections import defaultdict

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
    # Map action_id to expected tool name
    action_id_to_name = {}
    for task in tasks:
        actions = task.get('evaluation_criteria', {}).get('actions', [])
        for action in actions:
            action_id = action.get('action_id')
            if action_id:
                action_id_to_name[action_id] = action.get('name')
                
    simulations = data.get('simulations', [])
    updated = False
    
    for sim in simulations:
        reward_info = sim.get('reward_info') or sim.get('reward') or {}
        if not isinstance(reward_info, dict):
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
                        updated = True
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

def process_domain(domain_slug, manual_reward=False, action_threshold=0.8, nl_threshold=0.8, recorrect_action=False):
    domain_path = os.path.join(DATA_DIR, domain_slug)
    json_files = glob.glob(os.path.join(domain_path, '*.json'))
    
    results = []
    
    for jpath in json_files:
        try:
            with open(jpath, 'r') as f:
                data = json.load(f)
            if recorrect_action:
                if recorrect_simulation_actions(data):
                    print(f"Recorrected in memory (not overwritten): {jpath}")
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
        
        for sim in simulations:
            task_id = sim.get('task_id')
            reward_info = sim.get('reward_info') or sim.get('reward') or {}
            if isinstance(reward_info, float) or isinstance(reward_info, int):
                # Fallback if reward is just a number
                reward_info = {}
                
            action_score = compute_action_score(reward_info)
            nl_accuracy = compute_nl_accuracy(reward_info)
            
            total_action_score += action_score
            total_nl_accuracy += nl_accuracy
            
            if manual_reward:
                is_success = calculate_manual_reward(action_score, nl_accuracy, action_threshold, nl_threshold)
            else:
                sim_reward = sim.get('reward', 0)
                is_success = (sim_reward == 1.0)
            
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

        results.append({
            "model_name": model_name,
            "filename": os.path.basename(jpath),
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
    parser.add_argument('--manual_reward', action='store_true', help='Calculate reward manually from action and NL accuracy')
    parser.add_argument('--action_threshold', type=float, default=0.8, help='Threshold for action accuracy (default: 0.8)')
    parser.add_argument('--nl_threshold', type=float, default=0.8, help='Threshold for NL accuracy (default: 0.8)')
    parser.add_argument('--recorrect_action', action='store_true', help='Recorrect actions based on tool name and bypassable arguments, and overwrite JSON files')
    args = parser.parse_args()

    domains = ['urban_map_web', 'urban_satellite']
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    leaderboard_data = {}
    
    for domain in domains:
        print(f"Processing domain: {domain} (manual_reward={args.manual_reward}, recorrect_action={args.recorrect_action})")
        leaderboard_data[domain] = process_domain(
            domain, 
            manual_reward=args.manual_reward,
            action_threshold=args.action_threshold,
            nl_threshold=args.nl_threshold,
            recorrect_action=args.recorrect_action
        )
        
    out_path = os.path.join(OUTPUT_DIR, 'leaderboard.json')
    with open(out_path, 'w') as f:
        json.dump(leaderboard_data, f, indent=2)
        
    print(f"Leaderboard data written to {out_path}")

if __name__ == '__main__':
    main()
