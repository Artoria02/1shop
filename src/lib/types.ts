import type { UserKind } from "@prisma/client";

export interface SessionUser {
  userId: string;
  email: string | null;
  phone: string | null;
  kind: UserKind;
  roles: string[];
  merchantId?: string;
}

export interface SessionPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  kind: UserKind;
  roles: string[];
  merchantId?: string;
  iat?: number;
  exp?: number;
}