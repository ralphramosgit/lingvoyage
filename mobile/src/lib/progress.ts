import type { EncounterProgress } from '@/types/database';

import { supabase } from './supabase';

export async function fetchProgress(userId: string): Promise<EncounterProgress[]> {
  const { data, error } = await supabase
    .from('encounter_progress')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function recordEncounter(entry: {
  scenarioId: string;
  goalsCompleted: number;
  goalsTotal: number;
  completed: boolean;
}): Promise<void> {
  const { error } = await supabase.from('encounter_progress').insert({
    scenario_id: entry.scenarioId,
    goals_completed: entry.goalsCompleted,
    goals_total: entry.goalsTotal,
    completed: entry.completed,
  });
  if (error) throw error;
}
