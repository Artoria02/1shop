export type LoginEnd = "BUYER" | "MERCHANT" | "PLATFORM_ADMIN";

export interface SessionUser {
  userId: string;
  email: string | null;
  phone: string | null;
  end: LoginEnd;
  roles: string[];
  merchantId?: string;
  avatar?: string;
  displayName?: string;
  staff?: boolean;
}

export interface SessionPayload {
  sub: string;
  end: LoginEnd;
  roles: string[];
  merchantId?: string;
  sessionToken?: string;
  iat?: number;
  exp?: number;
}