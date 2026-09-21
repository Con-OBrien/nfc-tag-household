import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { UnauthorizedError } from '../types';

/**
 * SECURITY: JWT secrets must be provided via environment variables
 * NEVER use hardcoded defaults in production
 * 
 * Required environment variables:
 * - JWT_SECRET: Minimum 32 characters, should be cryptographically random
 * - JWT_EXPIRE: Token expiration time (e.g., '24h', '7d')
 */
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';

// Validate that JWT_SECRET is configured
if (!JWT_SECRET) {
  const errorMsg = 'CRITICAL: JWT_SECRET environment variable is not configured. ' +
    'This is required for secure token generation and verification. ' +
    'Set JWT_SECRET to a cryptographically random 32+ character string. ' +
    'Generate with: openssl rand -hex 32';
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error(errorMsg);
  } else {
    console.warn('⚠️  WARNING:', errorMsg);
  }
}

// Validate JWT_SECRET length (minimum 32 characters recommended)
if (JWT_SECRET && JWT_SECRET.length < 32) {
  console.warn('⚠️  WARNING: JWT_SECRET is less than 32 characters. ' +
    'Use a stronger secret for production.');
}

export interface JWTPayload {
  userId: string;
  householdId: string;
  role: 'owner' | 'member';
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT token
 * 
 * SECURITY:
 * - Token includes user ID, household ID, and role
 * - Tokens expire after configured duration (default 24h)
 * - Never include sensitive data (passwords, push tokens) in token payload
 * 
 * @param payload User identification data
 * @returns Signed JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured - cannot generate token');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  } as any);
}

/**
 * Verify JWT token
 * 
 * SECURITY:
 * - Validates token signature and expiration
 * - Uses constant-time comparison via jsonwebtoken library
 * - Throws UnauthorizedError for invalid/expired tokens
 * 
 * @param token JWT token string
 * @returns Verified JWT payload
 * @throws UnauthorizedError if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured - cannot verify token');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Extract token from Authorization header
 * 
 * Expected format: "Bearer <token>"
 * 
 * SECURITY:
 * - Validates "Bearer" prefix
 * - Prevents injection of other authentication schemes
 * 
 * @param authHeader HTTP Authorization header value
 * @returns Token string without "Bearer " prefix
 * @throws UnauthorizedError if header format is invalid
 */
export function extractToken(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }
  return authHeader.slice(7);
}

/**
 * Hash password using bcrypt
 * 
 * SECURITY:
 * - Uses bcrypt with salt rounds=10 (default, secure)
 * - Never store plaintext passwords
 * - Always compare with comparePassword() function
 * 
 * @param password Plaintext password to hash
 * @returns Hashed password with salt embedded
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Compare password with hash
 * 
 * SECURITY:
 * - Uses bcrypt's constant-time comparison
 * - Prevents timing attacks
 * - Returns false for any mismatch without leaking timing information
 * 
 * @param password Plaintext password to check
 * @param hash Hashed password to compare against
 * @returns true if password matches hash, false otherwise
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}
