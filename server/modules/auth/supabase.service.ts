import type {
  AuthConfig,
  SupabaseUser,
  OtpResponse,
  VerifyOtpResponse,
} from "./auth.types";

/**
 * Supabase authentication service.
 * Handles Phone OTP authentication and token verification.
 */
export class SupabaseService {
  private config: AuthConfig;
  private isConfigured: boolean;

  constructor() {
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseKey: process.env.SUPABASE_KEY || "",
      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
    };
    this.isConfigured = Boolean(
      this.config.supabaseUrl && this.config.supabaseKey,
    );
  }

  /**
   * Check if Supabase is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Send OTP to phone number
   */
  async sendOtp(phone: string): Promise<OtpResponse> {
    if (!this.isConfigured) {
      console.log(`[Mock] OTP sent to ${phone}`);
      return { success: true, message: "OTP sent (mock)" };
    }

    try {
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.config.supabaseKey,
        },
        body: JSON.stringify({
          phone,
          channel: "sms",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || "Failed to send OTP" };
      }

      return { success: true, message: "OTP sent successfully" };
    } catch (error) {
      console.error("Error sending OTP:", error);
      return { success: false, error: "Failed to send OTP" };
    }
  }

  /**
   * Verify OTP and get session
   */
  async verifyOtp(phone: string, token: string): Promise<VerifyOtpResponse> {
    if (!this.isConfigured) {
      console.log(`[Mock] OTP verified for ${phone}`);
      return {
        success: true,
        user: {
          id: `mock-user-${Date.now()}`,
          phone,
          created_at: new Date().toISOString(),
        },
        session: {
          access_token: `mock-token-${Date.now()}`,
          refresh_token: `mock-refresh-${Date.now()}`,
          expires_in: 3600,
        },
      };
    }

    try {
      const response = await fetch(
        `${this.config.supabaseUrl}/auth/v1/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.config.supabaseKey,
          },
          body: JSON.stringify({
            phone,
            token,
            type: "sms",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || "Invalid OTP" };
      }

      const data = await response.json();
      return {
        success: true,
        user: data.user,
        session: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
        },
      };
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return { success: false, error: "Failed to verify OTP" };
    }
  }

  /**
   * Verify JWT token and get user
   */
  async verifyToken(token: string): Promise<SupabaseUser | null> {
    if (!this.isConfigured) {
      // In mock mode, accept any token starting with "mock-"
      if (token.startsWith("mock-")) {
        return {
          id: "mock-user",
          phone: "+70000000000",
          created_at: new Date().toISOString(),
        };
      }
      return null;
    }

    try {
      const response = await fetch(`${this.config.supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: this.config.supabaseKey,
        },
      });

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      console.error("Error verifying token:", error);
      return null;
    }
  }

  /**
   * Refresh session token
   */
  async refreshSession(refreshToken: string): Promise<VerifyOtpResponse> {
    if (!this.isConfigured) {
      return {
        success: true,
        session: {
          access_token: `mock-token-${Date.now()}`,
          refresh_token: `mock-refresh-${Date.now()}`,
          expires_in: 3600,
        },
      };
    }

    try {
      const response = await fetch(
        `${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.config.supabaseKey,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
      );

      if (!response.ok) {
        return { success: false, error: "Failed to refresh session" };
      }

      const data = await response.json();
      return {
        success: true,
        user: data.user,
        session: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
        },
      };
    } catch (error) {
      console.error("Error refreshing session:", error);
      return { success: false, error: "Failed to refresh session" };
    }
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();
