import type { Request, Response, NextFunction } from 'express';

// URL parameter validation middleware
export function validateIdParam(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id = req.params.id;

  // Check if the ID parameter exists and has the right format (UUID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    res.status(400).json({ error: 'Invalid ID format' });
    return;
  }

  next();
}

// Global error handler middleware
export function errorHandler(err: Error, _req: Request, res: Response) {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}
