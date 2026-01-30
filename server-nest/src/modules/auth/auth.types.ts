export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface OtpSendRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  token: string;
}

export interface RefreshRequest {
  refresh_token: string;
}
