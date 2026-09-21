import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../types';

/**
 * Auth Middleware - Validates user authentication
 * Extracts userId and householdId from request headers
 * In production, this would validate JWT tokens or session cookies
 * For now, uses header-based authentication for testing
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  householdId?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // For testing/demo: extract from headers
  // In production: validate JWT token from Authorization header
  const userId = req.headers['x-user-id'] as string;
  const householdId = req.headers['x-household-id'] as string;

  if (!userId || !householdId) {
    throw new UnauthorizedError('Missing required authentication headers: x-user-id and x-household-id');
  }

  req.userId = userId;
  req.householdId = householdId;

  next();
}
