import { Router } from "express";
import { AuthService } from "../services/AuthService";
import jwt from "jsonwebtoken";
import { authenticateJWT, authorizeRoles, optionalAuthenticateJWT } from "../middleware/jwt";
import { UserRepository } from "../repositories/UserRepository";
import { UserService } from "../services/UserService";
import { ActivityLoggerService } from "../services/ActivityLoggerService";

const router = Router();

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET || "dev-secret-change") + "-refresh";

function setRefreshCookie(res: any, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax', // Cambiado de 'strict' a 'lax' para permitir cookies entre subdominios
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'username and password are required' });
  }
  const user = await AuthService.validateCredentials(username, password);
  if (!user) {
    ActivityLoggerService.logAlert(req, `Intento de login fallido para usuario "${username}"`, {
      module: 'auth',
      action: 'login_failed',
      severity: 'warning',
      username,
    });
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const accessToken = AuthService.generateAccessToken(user);
  const refreshToken = AuthService.generateRefreshToken(user);
  await AuthService.persistRefreshToken(user.id, refreshToken);

  if (process.env.JWT_USE_COOKIES === 'true') setRefreshCookie(res, refreshToken);

  ActivityLoggerService.logActivity(req, `Login exitoso: ${user.username} (${user.role})`, {
    module: 'auth',
    action: 'login',
    user_id: user.id,
    username: user.username,
    user_role: user.role,
  });

  return res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken,
      refreshToken: process.env.JWT_USE_COOKIES === 'true' ? undefined : refreshToken,
      user: { id: user.id, username: user.username, role: user.role, firstName: user.first_name, lastName: user.last_name }
    }
  });
});

router.post('/refresh', async (req, res) => {
  const tokenFromCookie = req.cookies?.refresh_token;
  const tokenFromBody = req.body?.refreshToken;
  const refreshToken = tokenFromCookie || tokenFromBody;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Missing refresh token' });

  try {
    const decoded: any = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const { valid, userId } = await AuthService.isRefreshTokenValid(refreshToken);
    if (!valid || !userId) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    const user = await UserRepository.findById(userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const tokens = await AuthService.rotateRefreshToken(refreshToken, user);
    if (process.env.JWT_USE_COOKIES === 'true') setRefreshCookie(res, tokens.refreshToken);

    return res.json({ success: true, message: 'Token refreshed', data: { accessToken: tokens.accessToken, refreshToken: process.env.JWT_USE_COOKIES === 'true' ? undefined : tokens.refreshToken } });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const tokenFromCookie = req.cookies?.refresh_token;
  const tokenFromBody = req.body?.refreshToken;
  const refreshToken = tokenFromCookie || tokenFromBody;
  if (refreshToken) await AuthService.revokeRefreshToken(refreshToken);
  if (process.env.JWT_USE_COOKIES === 'true') res.clearCookie('refresh_token', { path: '/api/auth' });
  return res.json({ success: true, message: 'Logged out' });
});

router.get('/me', authenticateJWT, async (req: any, res) => {
  return res.json({ success: true, data: { user: req.user } });
});

// Registration endpoint
// - If there are 0 users in DB, allow open registration for the bootstrap admin/gerencia
// - Otherwise, require JWT with role admin or gerencia
router.post('/register', optionalAuthenticateJWT, async (req: any, res) => {
  const { username, email, password, firstName, lastName, role } = req.body || {};
  if (!username || !email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ success: false, message: 'Missing fields: username, email, password, firstName, lastName, role are required' });
  }

  const usersCount = await UserRepository.countAll();
  if (usersCount > 0) {
    // Require admin/gerencia to create new users
    if (!req.user || !['admin', 'gerencia'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admin/gerencia can create users' });
    }
  }

  try {
    const newId = await UserService.createUser({ username, email, password, firstName, lastName, role });
    return res.status(201).json({ success: true, message: 'User created', data: { id: newId } });
  } catch (err: any) {
    if (String(err?.message || '').toLowerCase().includes('duplicate')) {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    return res.status(400).json({ success: false, message: err?.message || 'Failed to create user' });
  }
});

export default router;
