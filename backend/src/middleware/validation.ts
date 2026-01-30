import type { Request, Response, NextFunction } from 'express';

// Standardized error response interface
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  timestamp: string;
  path: string;
  method: string;
}

// Create standardized error response
export function createErrorResponse(
  req: Request,
  error: string,
  message?: string,
  details?: unknown
): ErrorResponse {
  return {
    error,
    message,
    details,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };
}

// Custom error classes for better error handling
export class ValidationError extends Error {
  public details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

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
  if (!id || Array.isArray(id) || !uuidRegex.test(id)) {
    const errorResponse = createErrorResponse(
      req,
      'Invalid ID format',
      'ID must be a valid UUID'
    );
    res.status(400).json(errorResponse);
    return;
  }

  next();
}

// Global error handler middleware
export function errorHandler(err: Error, req: Request, res: Response) {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  let status = 500;
  let errorMessage = 'Internal server error';
  let details: unknown = undefined;

  // Handle specific error types
  if (err instanceof ValidationError) {
    status = 400;
    errorMessage = err.message;
    details = err.details;
  } else if (err instanceof NotFoundError) {
    status = 404;
    errorMessage = err.message;
  } else if (err instanceof ConflictError) {
    status = 409;
    errorMessage = err.message;
  }

  const errorResponse = createErrorResponse(
    req,
    errorMessage,
    process.env.NODE_ENV === 'development' ? err.message : undefined,
    details
  );

  res.status(status).json(errorResponse);
}
