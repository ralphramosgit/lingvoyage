// Shape of the Supabase tables created in docs/setup/02-supabase.md.

export type Profile = {
  id: string;
  display_name: string | null;
  target_language: string | null;
  native_language: string;
  onboarding_complete: boolean;
  created_at: string;
};

export type EncounterProgress = {
  id: string;
  user_id: string;
  scenario_id: string;
  goals_completed: number;
  goals_total: number;
  completed: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Omit<Profile, 'id'>> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      encounter_progress: {
        Row: EncounterProgress;
        Insert: Partial<Omit<EncounterProgress, 'scenario_id'>> & { scenario_id: string };
        Update: Partial<EncounterProgress>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
