import type { UserRole } from "./enums.js";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  fullName: string;
  emailVerifiedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  userId: string;
  permissionLevel: "verifier" | "superadmin";
}

export interface CafeAccount {
  id: string;
  name: string;
  province: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface CafeStaff {
  id: string;
  userId: string;
  cafeAccountId: string;
}

export interface AssistedSession {
  id: string;
  cafeStaffId: string;
  applicantUserId: string;
  status: "pending" | "open" | "closed";
  openedAt: string;
  authorizedAt: string | null;
  closedAt: string | null;
  openedReason: string | null;
}
