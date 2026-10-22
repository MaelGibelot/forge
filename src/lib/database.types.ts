// Généré par npm run db:types depuis la migration versionnée.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      bodyweight_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          weight: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          weight?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bodyweight_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_muscles: {
        Row: {
          exercise_id: string;
          muscle: string;
          role: string;
        };
        Insert: {
          exercise_id: string;
          muscle: string;
          role: string;
        };
        Update: {
          exercise_id?: string;
          muscle?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_muscles_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_muscles_muscle_fkey';
            columns: ['muscle'];
            isOneToOne: false;
            referencedRelation: 'muscles';
            referencedColumns: ['name'];
          },
        ];
      };
      exercise_progression: {
        Row: {
          user_id: string;
          exercise_id: string;
          increment: number;
          reps_min: number;
          reps_max: number;
        };
        Insert: {
          user_id: string;
          exercise_id: string;
          increment?: number;
          reps_min?: number;
          reps_max?: number;
        };
        Update: {
          user_id?: string;
          exercise_id?: string;
          increment?: number;
          reps_min?: number;
          reps_max?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_progression_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_progression_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          english_name: string | null;
          description: string;
          category: string;
          equipment: string;
          primary_muscle: string;
          instructions: string[];
          tips: string;
          mistakes: string;
          load_kind: string;
          supports_1rm: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          english_name?: string | null;
          description?: string;
          category?: string;
          equipment: string;
          primary_muscle: string;
          instructions?: string[];
          tips?: string;
          mistakes?: string;
          load_kind?: string;
          supports_1rm?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          english_name?: string | null;
          description?: string;
          category?: string;
          equipment?: string;
          primary_muscle?: string;
          instructions?: string[];
          tips?: string;
          mistakes?: string;
          load_kind?: string;
          supports_1rm?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_primary_muscle_fkey';
            columns: ['primary_muscle'];
            isOneToOne: false;
            referencedRelation: 'muscles';
            referencedColumns: ['name'];
          },
          {
            foreignKeyName: 'exercises_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      muscles: {
        Row: {
          name: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      program_days: {
        Row: {
          id: string;
          user_id: string;
          program_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id: string;
          user_id: string;
          program_id: string;
          name: string;
          position: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          program_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'program_days_program_id_user_id_fkey';
            columns: ['program_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'programs';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'program_days_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      program_exercises: {
        Row: {
          id: string;
          user_id: string;
          day_id: string;
          exercise_id: string;
          name: string;
          primary_muscle: string;
          load_kind: string;
          supports_1rm: boolean;
          position: number;
          group_id: string | null;
          target_sets: number;
          reps_min: number;
          reps_max: number;
          target_weight: number | null;
          target_rpe: number | null;
          target_rir: number | null;
          target_rest_seconds: number | null;
          increment: number;
          notes: string;
        };
        Insert: {
          id: string;
          user_id: string;
          day_id: string;
          exercise_id: string;
          name: string;
          primary_muscle: string;
          load_kind: string;
          supports_1rm: boolean;
          position: number;
          group_id?: string | null;
          target_sets: number;
          reps_min: number;
          reps_max: number;
          target_weight?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          target_rest_seconds?: number | null;
          increment: number;
          notes?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_id?: string;
          exercise_id?: string;
          name?: string;
          primary_muscle?: string;
          load_kind?: string;
          supports_1rm?: boolean;
          position?: number;
          group_id?: string | null;
          target_sets?: number;
          reps_min?: number;
          reps_max?: number;
          target_weight?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          target_rest_seconds?: number | null;
          increment?: number;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'program_exercises_day_id_user_id_fkey';
            columns: ['day_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'program_days';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'program_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'program_exercises_group_id_day_id_user_id_fkey';
            columns: ['group_id', 'day_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'program_superset_groups';
            referencedColumns: ['id', 'day_id', 'user_id'];
          },
          {
            foreignKeyName: 'program_exercises_primary_muscle_fkey';
            columns: ['primary_muscle'];
            isOneToOne: false;
            referencedRelation: 'muscles';
            referencedColumns: ['name'];
          },
          {
            foreignKeyName: 'program_exercises_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      program_superset_groups: {
        Row: {
          id: string;
          user_id: string;
          day_id: string;
          name: string;
          rounds: number;
          rest_seconds: number | null;
        };
        Insert: {
          id: string;
          user_id: string;
          day_id: string;
          name: string;
          rounds: number;
          rest_seconds?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_id?: string;
          name?: string;
          rounds?: number;
          rest_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'program_superset_groups_day_id_user_id_fkey';
            columns: ['day_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'program_days';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'program_superset_groups_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      programs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          active: boolean;
          revision: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          description?: string;
          active?: boolean;
          revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          active?: boolean;
          revision?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'programs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_preferences: {
        Row: {
          user_id: string;
          recommendations: boolean;
          history_count: number;
          max_rpe: number | null;
          min_rir: number | null;
        };
        Insert: {
          user_id: string;
          recommendations?: boolean;
          history_count?: number;
          max_rpe?: number | null;
          min_rir?: number | null;
        };
        Update: {
          user_id?: string;
          recommendations?: boolean;
          history_count?: number;
          max_rpe?: number | null;
          min_rir?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          name: string;
          primary_muscle: string;
          load_kind: string;
          supports_1rm: boolean;
          position: number;
          group_id: string | null;
          technique_ok: boolean;
          target_sets: number;
          reps_min: number;
          reps_max: number;
          target_weight: number | null;
          target_rpe: number | null;
          target_rir: number | null;
          target_rest_seconds: number | null;
          increment: number;
          notes: string;
        };
        Insert: {
          id: string;
          user_id: string;
          session_id: string;
          exercise_id: string;
          name: string;
          primary_muscle: string;
          load_kind: string;
          supports_1rm: boolean;
          position: number;
          group_id?: string | null;
          technique_ok?: boolean;
          target_sets: number;
          reps_min: number;
          reps_max: number;
          target_weight?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          target_rest_seconds?: number | null;
          increment: number;
          notes?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          exercise_id?: string;
          name?: string;
          primary_muscle?: string;
          load_kind?: string;
          supports_1rm?: boolean;
          position?: number;
          group_id?: string | null;
          technique_ok?: boolean;
          target_sets?: number;
          reps_min?: number;
          reps_max?: number;
          target_weight?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          target_rest_seconds?: number | null;
          increment?: number;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_exercises_group_id_session_id_user_id_fkey';
            columns: ['group_id', 'session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_superset_groups';
            referencedColumns: ['id', 'session_id', 'user_id'];
          },
          {
            foreignKeyName: 'workout_exercises_primary_muscle_fkey';
            columns: ['primary_muscle'];
            isOneToOne: false;
            referencedRelation: 'muscles';
            referencedColumns: ['name'];
          },
          {
            foreignKeyName: 'workout_exercises_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'workout_exercises_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_round_rests: {
        Row: {
          user_id: string;
          session_id: string;
          group_id: string;
          round: number;
          rest_seconds: number | null;
        };
        Insert: {
          user_id: string;
          session_id: string;
          group_id: string;
          round: number;
          rest_seconds?: number | null;
        };
        Update: {
          user_id?: string;
          session_id?: string;
          group_id?: string;
          round?: number;
          rest_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_round_rests_group_id_session_id_user_id_fkey';
            columns: ['group_id', 'session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_superset_groups';
            referencedColumns: ['id', 'session_id', 'user_id'];
          },
          {
            foreignKeyName: 'workout_round_rests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          source_day_id: string | null;
          name: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          notes: string;
          revision: number;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          source_day_id?: string | null;
          name: string;
          status: string;
          started_at: string;
          finished_at?: string | null;
          notes?: string;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_day_id?: string | null;
          name?: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          notes?: string;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sessions_source_day_id_fkey';
            columns: ['source_day_id'];
            isOneToOne: false;
            referencedRelation: 'program_days';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sets: {
        Row: {
          id: string;
          user_id: string;
          workout_exercise_id: string;
          position: number;
          weight: number | null;
          reps: number;
          rpe: number | null;
          rir: number | null;
          rest_seconds: number | null;
          type: string;
          completed: boolean;
          notes: string;
          duration_seconds: number | null;
          distance_km: number | null;
        };
        Insert: {
          id: string;
          user_id: string;
          workout_exercise_id: string;
          position: number;
          weight?: number | null;
          reps: number;
          rpe?: number | null;
          rir?: number | null;
          rest_seconds?: number | null;
          type: string;
          completed?: boolean;
          notes?: string;
          duration_seconds?: number | null;
          distance_km?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_exercise_id?: string;
          position?: number;
          weight?: number | null;
          reps?: number;
          rpe?: number | null;
          rir?: number | null;
          rest_seconds?: number | null;
          type?: string;
          completed?: boolean;
          notes?: string;
          duration_seconds?: number | null;
          distance_km?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sets_workout_exercise_id_user_id_fkey';
            columns: ['workout_exercise_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_exercises';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      workout_superset_groups: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          name: string;
          rounds: number;
          rest_seconds: number | null;
        };
        Insert: {
          id: string;
          user_id: string;
          session_id: string;
          name: string;
          rounds: number;
          rest_seconds?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          name?: string;
          rounds?: number;
          rest_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_superset_groups_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sessions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'workout_superset_groups_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          revision: number;
          name: string;
          definition: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          revision?: number;
          name: string;
          definition: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          revision?: number;
          name?: string;
          definition?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_templates_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
    Functions: {
      read_programs: { Args: Record<string, never>; Returns: Json };
      read_workouts: {
        Args: {
          page_offset?: number;
          page_size?: number;
          since_date?: string | null;
          only_id?: string | null;
          only_exercise?: string | null;
        };
        Returns: Json;
      };
      save_program: { Args: { payload: Json }; Returns: number };
      save_workout: { Args: { payload: Json }; Returns: number };
      resolve_login: { Args: { login: string }; Returns: string | null };
      register_login: {
        Args: { login: string; identity: string; technical_email: string };
        Returns: undefined;
      };
      lookup_login_user: { Args: { login: string }; Returns: string | null };
      consume_login_attempt: { Args: { bucket: string; max_attempts: number }; Returns: boolean };
    };
  };
};
