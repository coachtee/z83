import type { User, UserRole } from "@z83/types";
import { query } from "../db.js";

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  full_name: string;
  email_verified_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

function mapUser(row: UserRow): User & { passwordHash: string } {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    fullName: row.full_name,
    emailVerifiedAt: row.email_verified_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  role?: UserRole;
}): Promise<User> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.email, input.passwordHash, input.fullName, input.role ?? "applicant"],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  const { passwordHash: _passwordHash, ...user } = mapUser(row);
  return user;
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await query<UserRow>(
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );
  const row = rows[0];
  return row ? mapUser(row) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const { passwordHash: _passwordHash, ...user } = mapUser(row);
  return user;
}
