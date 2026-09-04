import { query } from "../db.js";

interface AdminUserRow {
  id: string;
  user_id: string;
  permission_level: "verifier" | "superadmin";
}

export async function getAdminUserByUserId(userId: string): Promise<AdminUserRow | null> {
  const { rows } = await query<AdminUserRow>(`SELECT * FROM admin_users WHERE user_id = $1`, [
    userId,
  ]);
  return rows[0] ?? null;
}

export async function createAdminUser(
  userId: string,
  permissionLevel: "verifier" | "superadmin" = "superadmin",
): Promise<AdminUserRow> {
  const { rows } = await query<AdminUserRow>(
    `INSERT INTO admin_users (user_id, permission_level) VALUES ($1, $2) RETURNING *`,
    [userId, permissionLevel],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert did not return a row.");
  return row;
}
