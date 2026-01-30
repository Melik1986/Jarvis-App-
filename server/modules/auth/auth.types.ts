import type { Request } from "express";

/**
 * Types for Supabase authentication
 */

export interface AuthConfig {
  supabaseUrl: string;
  supabaseKey: string;
  supabaseServiceKey?: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  user?: SupabaseUser;
  token?: string;
}

export interface OtpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  user?: SupabaseUser;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  error?: string;
}
