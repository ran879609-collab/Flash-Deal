import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db/database';
import { UserProfile, UserRole } from '../src/types';

const TOKEN_SECRET = process.env.APP_SECRET || 'cyclepro_secure_token_secret_key_2026';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function generateToken(user: UserProfile): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };

  const strPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(strPayload)
    .digest('base64url');

  return `${strPayload}.${signature}`;
}

export function verifyToken(token: string): UserProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [strPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(strPayload)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(strPayload, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    const storedUser = db.findUserById(payload.id);
    if (!storedUser) return null;

    const { passwordHash, ...userProfile } = storedUser;
    return userProfile;
  } catch (err) {
    return null;
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权：请先登录系统' });
  }

  const token = authHeader.split(' ')[1];
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: '登录会话已过期或无效，请重新登录' });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `权限不足：该操作需要 [${allowedRoles.join('/')}] 角色权限，当前为 [${req.user.role}]`,
      });
    }

    next();
  };
}
