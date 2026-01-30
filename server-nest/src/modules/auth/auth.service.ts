import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AuthUser, AuthSession } from "./auth.types";

@Injectable()
export class AuthService {
  private supabase: SupabaseClient | null = null;

  constructor(private configService: ConfigService) {
    const url = this.configService.get("SUPABASE_URL");
    const key = this.configService.get("SUPABASE_KEY");

    if (url && key) {
      this.supabase = createClient(url, key);
    }
  }

  isConfigured(): boolean {
    return this.supabase !== null;
  }

  async sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      // Mock mode
      return { success: true };
    }

    try {
      const { error } = await this.supabase.auth.signInWithOtp({ phone });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send OTP",
      };
    }
  }

  async verifyOtp(
    phone: string,
    token: string,
  ): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    if (!this.supabase) {
      // Mock mode
      return {
        success: true,
        user: { id: "mock-user-id", phone },
        session: {
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        },
      };
    }

    try {
      const { data, error } = await this.supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: data.user
          ? {
              id: data.user.id,
              phone: data.user.phone,
              email: data.user.email,
            }
          : undefined,
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_in: data.session.expires_in || 3600,
            }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify OTP",
      };
    }
  }

  async refreshSession(refreshToken: string): Promise<{
    success: boolean;
    user?: AuthUser;
    session?: AuthSession;
    error?: string;
  }> {
    if (!this.supabase) {
      return {
        success: true,
        session: {
          access_token: "mock-access-token-refreshed",
          refresh_token: "mock-refresh-token-refreshed",
          expires_in: 3600,
        },
      };
    }

    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        user: data.user
          ? {
              id: data.user.id,
              phone: data.user.phone,
              email: data.user.email,
            }
          : undefined,
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_in: data.session.expires_in || 3600,
            }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh session",
      };
    }
  }

  async validateToken(
    token: string,
  ): Promise<{ valid: boolean; user?: AuthUser }> {
    if (!this.supabase) {
      return { valid: true, user: { id: "mock-user-id" } };
    }

    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data.user) {
        return { valid: false };
      }
      return {
        valid: true,
        user: {
          id: data.user.id,
          phone: data.user.phone,
          email: data.user.email,
        },
      };
    } catch {
      return { valid: false };
    }
  }
}
