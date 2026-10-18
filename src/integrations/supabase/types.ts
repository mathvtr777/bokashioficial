export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TxStatus = "Concluído" | "Pendente" | "Em análise" | "Expirado" | "Cancelado";
export type TxType = "Entrada" | "Saída";

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          name: string;
          type: TxType;
          date: string;
          value: number;
          status: TxStatus;
          created_at: string;
          user_id?: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: TxType;
          date?: string;
          value: number;
          status?: TxStatus;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: TxType;
          date?: string;
          value?: number;
          status?: TxStatus;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          code: string;
          name: string;
          symbol: string;
          balance: string;
          share: number;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol: string;
          balance: string;
          share: number;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          symbol?: string;
          balance?: string;
          share?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      financial_stats: {
        Row: {
          key: string;
          title: string;
          value: number;
          desc: string;
          icon: string;
          category: "main" | "secondary";
          formatted_value: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          title: string;
          value: number;
          desc: string;
          icon: string;
          category?: "main" | "secondary";
          formatted_value?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          title?: string;
          value?: number;
          desc?: string;
          icon?: string;
          category?: "main" | "secondary";
          formatted_value?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
