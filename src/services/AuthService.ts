import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRepository, DBUser } from "../repositories/UserRepository";
import { executeQuery } from "../config/database";

const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_EXPIRES_IN || "24h") as jwt.SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL = (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];
const JWT_SECRET = (process.env.JWT_SECRET || "dev-secret-change") as jwt.Secret;
const JWT_REFRESH_SECRET = (process.env.JWT_REFRESH_SECRET || (JWT_SECRET as string) + "-refresh") as jwt.Secret;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const AuthService = {
  async validateCredentials(username: string, password: string): Promise<DBUser | null> {
    const user = await UserRepository.findByUsername(username);
    if (!user) return null;
    if (user.is_active === 0 || user.is_active === false) return null;

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;
    return user;
  },

  generateAccessToken(user: DBUser): string {
    const payload = {
      sub: String(user.id),
      username: user.username,
      role: user.role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  },

  generateRefreshToken(user: DBUser): string {
    const payload = { sub: String(user.id), type: "refresh" };
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  },

  async persistRefreshToken(userId: number, token: string): Promise<void> {
    // Optionally store the raw token or a hash. Here we store the raw token in DB restricted table.
    const sql = `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`;
    await executeQuery(sql, [userId, token]);
  },

  async revokeRefreshToken(token: string): Promise<void> {
    const sql = `UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW() WHERE token = ?`;
    await executeQuery(sql, [token]);
  },

  async isRefreshTokenValid(token: string): Promise<{ valid: boolean; userId?: number }>{
    const sql = `SELECT user_id, revoked, expires_at FROM refresh_tokens WHERE token = ? LIMIT 1`;
    const rows = await executeQuery(sql, [token]);
    const arr = rows as Array<{ user_id: number; revoked: number; expires_at: Date }>;
    if (!arr || !arr.length) return { valid: false };
    const row = arr[0];
    if (row.revoked) return { valid: false };
    if (new Date(row.expires_at) < new Date()) return { valid: false };
    return { valid: true, userId: row.user_id };
  },

  async rotateRefreshToken(oldToken: string, user: DBUser): Promise<AuthTokens> {
    await this.revokeRefreshToken(oldToken);
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    await this.persistRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }
};
