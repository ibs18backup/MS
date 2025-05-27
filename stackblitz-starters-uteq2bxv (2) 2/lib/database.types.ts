export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      classes: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'classes_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          }
        ];
      };
      fee_type_classes: {
        Row: {
          class_id: string;
          created_at: string;
          fee_type_id: string;
          id: string;
          school_id: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          fee_type_id: string;
          id?: string;
          school_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          fee_type_id?: string;
          id?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fee_type_classes_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fee_type_classes_fee_type_id_fkey';
            columns: ['fee_type_id'];
            isOneToOne: false;
            referencedRelation: 'fee_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fee_type_classes_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          }
        ];
      };
      fee_types: {
        Row: {
          applicable_from: string | null;
          applicable_until: string | null;
          created_at: string;
          default_amount: number;
          description: string | null;
          id: string;
          name: string;
          scheduled_date: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          applicable_from?: string | null;
          applicable_until?: string | null;
          created_at?: string;
          default_amount?: number;
          description?: string | null;
          id?: string;
          name: string;
          scheduled_date?: string | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          applicable_from?: string | null;
          applicable_until?: string | null;
          created_at?: string;
          default_amount?: number;
          description?: string | null;
          id?: string;
          name?: string;
          scheduled_date?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fee_types_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          }
        ];
      };
      ledger_entries: {
        Row: {
          balance: number;
          created_at: string;
          credit: number;
          date: string;
          debit: number;
          description: string;
          id: string;
          payment_id: string | null;
          receipt_number: string | null;
          school_id: string;
          student_fee_type_id: number | null;
          student_id: string;
          type: string;
        };
        Insert: {
          balance: number;
          created_at?: string;
          credit?: number;
          date?: string;
          debit?: number;
          description: string;
          id?: string;
          payment_id?: string | null;
          receipt_number?: string | null;
          school_id: string;
          student_fee_type_id?: number | null;
          student_id: string;
          type: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          credit?: number;
          date?: string;
          debit?: number;
          description?: string;
          id?: string;
          payment_id?: string | null;
          receipt_number?: string | null;
          school_id?: string;
          student_fee_type_id?: number | null;
          student_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_student_fee_type_id_fkey';
            columns: ['student_fee_type_id'];
            isOneToOne: false;
            referencedRelation: 'student_fee_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
      payments: {
        Row: {
          amount_paid: number;
          created_at: string;
          date: string;
          description: string | null;
          id: string;
          mode_of_payment: string;
          receipt_number: string | null;
          school_id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount_paid: number;
          created_at?: string;
          date?: string;
          description?: string | null;
          id?: string;
          mode_of_payment: string;
          receipt_number?: string | null;
          school_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          created_at?: string;
          date?: string;
          description?: string | null;
          id?: string;
          mode_of_payment?: string;
          receipt_number?: string | null;
          school_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
      school_administrators: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          school_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: string;
          school_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          school_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'school_administrators_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          }
        ];
      };
      schools: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_fee_types: {
        Row: {
          assigned_amount: number;
          created_at: string;
          discount: number | null;
          discount_description: string | null;
          fee_type_id: string;
          id: number;
          net_payable_amount: number | null;
          school_id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_amount: number;
          created_at?: string;
          discount?: number | null;
          discount_description?: string | null;
          fee_type_id: string;
          id?: number;
          net_payable_amount?: number | null;
          school_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_amount?: number;
          created_at?: string;
          discount?: number | null;
          discount_description?: string | null;
          fee_type_id?: string;
          id?: number;
          net_payable_amount?: number | null;
          school_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_fee_types_fee_type_id_fkey';
            columns: ['fee_type_id'];
            isOneToOne: false;
            referencedRelation: 'fee_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_fee_types_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_fee_types_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          }
        ];
      };
      students: {
        Row: {
          academic_year: string;
          class_id: string;
          created_at: string;
          id: string;
          is_passed_out: boolean;
          name: string;
          roll_no: string;
          school_id: string;
          status: string | null;
          total_fees: number;
          updated_at: string;
        };
        Insert: {
          academic_year: string;
          class_id: string;
          created_at?: string;
          id?: string;
          is_passed_out?: boolean;
          name: string;
          roll_no: string;
          school_id: string;
          status?: string | null;
          total_fees?: number;
          updated_at?: string;
        };
        Update: {
          academic_year?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
          is_passed_out?: boolean;
          name?: string;
          roll_no?: string;
          school_id?: string;
          status?: string | null;
          total_fees?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'students_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_current_user_school_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
      DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
