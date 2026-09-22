// Database types. Filled in during phase 2 to match supabase/migrations.
// Kept hand-written and small so the app has no generated-code step.

export type Role = "tutor" | "staff";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: Role;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Role;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
