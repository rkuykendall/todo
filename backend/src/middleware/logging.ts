import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = uuidv4().slice(0, 8);

  console.log(`[${requestId}] ${req.method} ${req.path} started`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}
