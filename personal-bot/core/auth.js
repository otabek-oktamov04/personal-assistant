import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function verifyMaster(password) {
  return bcrypt.compareSync(password, process.env.MASTER_PASSWORD_HASH.trim());
}

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET.trim(), { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET.trim());
}

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
