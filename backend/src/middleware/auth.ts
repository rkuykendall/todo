import type { Request, Response, NextFunction } from 'express';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'default-password';

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  // Skip auth for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const passwordToCheck = token.trim();

  if (passwordToCheck !== AUTH_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
