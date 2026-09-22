// Hand-written database types matching supabase/migrations. Kept small so the
// app has no generated-code step. Update alongside the migrations.

export type Role = "tutor" | "staff";
export type SessionCode = "TA" | "SA" | "H";
export type GoalCategory = "A" | "B" | "C" | "D" | "E";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
};

type StudentRow = {
  id: string;
  tutor_id: string;
  full_name: string;
  tutoring_site: string;
  default_days: string | null;
  default_times: string | null;
  is_stopped: boolean;
  stopped_reason: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
};

type RecurrenceRuleRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  weekday: number;
  start_date: string;
  end_date: string | null;
  default_hours: number;
  /** "HH:MM:SS" as Postgres returns a time, or null. */
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

type SessionRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  session_date: string;
  hours: number;
  code: SessionCode | null;
  recurrence_rule_id: string | null;
  notes: string | null;
  /** "HH:MM:SS" as Postgres returns a time, or null on coded and older rows. */
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
};

type GoalDefinitionRow = {
  id: string;
  category: GoalCategory;
  category_label: string;
  number: number;
  label: string;
  starred: boolean;
};

type GoalAchievementRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  goal_id: string;
  attained: boolean;
  attained_on: string | null;
  other_text: string | null;
  updated_at: string;
};

type CustomGoalRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  label: string;
  attained: boolean;
  attained_on: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type MonthlyReportRow = {
  id: string;
  student_id: string;
  tutor_id: string;
  fiscal_year: number;
  month: number;
  version: number;
  submitted_at: string;
  snapshot: Json;
};

type WithDefaults<Row, Defaulted extends keyof Row> = Omit<Row, Defaulted> & Partial<Pick<Row, Defaulted>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: WithDefaults<ProfileRow, "full_name" | "created_at">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      students: {
        Row: StudentRow;
        Insert: WithDefaults<
          StudentRow,
          "id" | "default_days" | "default_times" | "is_stopped" | "stopped_reason" | "stopped_at" | "created_at" | "updated_at"
        >;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      recurrence_rules: {
        Row: RecurrenceRuleRow;
        Insert: WithDefaults<RecurrenceRuleRow, "id" | "end_date" | "default_hours" | "start_time" | "end_time" | "created_at">;
        Update: Partial<RecurrenceRuleRow>;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: WithDefaults<
          SessionRow,
          "id" | "hours" | "code" | "recurrence_rule_id" | "notes" | "start_time" | "end_time" | "created_at" | "updated_at"
        >;
        Update: Partial<SessionRow>;
        Relationships: [];
      };
      goal_definitions: {
        Row: GoalDefinitionRow;
        Insert: WithDefaults<GoalDefinitionRow, "starred">;
        Update: Partial<GoalDefinitionRow>;
        Relationships: [];
      };
      goal_achievements: {
        Row: GoalAchievementRow;
        Insert: WithDefaults<GoalAchievementRow, "id" | "attained" | "attained_on" | "other_text" | "updated_at">;
        Update: Partial<GoalAchievementRow>;
        Relationships: [];
      };
      custom_goals: {
        Row: CustomGoalRow;
        Insert: WithDefaults<CustomGoalRow, "id" | "attained" | "attained_on" | "sort_order" | "created_at" | "updated_at">;
        Update: Partial<CustomGoalRow>;
        Relationships: [];
      };
      monthly_reports: {
        Row: MonthlyReportRow;
        Insert: WithDefaults<MonthlyReportRow, "id" | "submitted_at">;
        Update: Partial<MonthlyReportRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fiscal_year_of: { Args: { d: string }; Returns: number };
      fiscal_year_end: { Args: { d: string }; Returns: string };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      is_tutor: { Args: Record<string, never>; Returns: boolean };
      owns_student: { Args: { sid: string }; Returns: boolean };
      create_recurring_sessions: {
        Args: {
          p_student_id: string;
          p_weekday: number;
          p_start_date: string;
          p_end_date: string;
          p_hours: number;
          p_dates: string[];
          p_start_time?: string | null;
          p_end_time?: string | null;
        };
        Returns: string;
      };
      update_recurring_sessions_from: {
        Args: {
          p_rule_id: string;
          p_from_date: string;
          p_hours: number;
          p_code: string | null;
          p_start_time?: string | null;
          p_end_time?: string | null;
        };
        Returns: number;
      };
      delete_recurring_sessions_from: {
        Args: { p_rule_id: string; p_from_date: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Profile = Tables<"profiles">;
export type Student = Tables<"students">;
export type RecurrenceRule = Tables<"recurrence_rules">;
export type Session = Tables<"sessions">;
export type GoalDefinition = Tables<"goal_definitions">;
export type GoalAchievement = Tables<"goal_achievements">;
export type CustomGoal = CustomGoalRow;
export type MonthlyReport = Tables<"monthly_reports">;
