import { logger } from '@librechat/data-schemas';
import { SystemRoles } from 'librechat-data-provider';
import type { NextFunction, Response } from 'express';
import type { ServerRequest } from '~/types/http';

/**
 * Middleware to check if authenticated user has admin role.
 * Should be used AFTER authentication middleware (requireJwtAuth, requireLocalAuth, etc.)
 */
export const requireAdmin = (req: ServerRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    logger.warn('[requireAdmin] No user found in request');
    return res.status(401).json({
      error: 'Authentication required',
      error_code: 'AUTHENTICATION_REQUIRED',
    });
  }

  if (!req.user.role || req.user.role !== SystemRoles.ADMIN) {
    logger.debug(`[requireAdmin] Access denied for non-admin user: ${req.user.email}`);
    return res.status(403).json({
      error: 'Access denied: Admin privileges required',
      error_code: 'ADMIN_REQUIRED',
    });
  }

  next();
};

/**
 * Middleware to check if user is banned.
 * Should be used AFTER authentication middleware.
 */
export const requireNotBanned = (req: ServerRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      error_code: 'AUTHENTICATION_REQUIRED',
    });
  }

  // @ts-ignore - status field may not be in type definition yet
  if (req.user.status === 'banned') {
    logger.debug(`[requireNotBanned] Banned user attempted access: ${req.user.email}`);
    return res.status(403).json({
      error: 'Your account has been suspended. Please contact support.',
      error_code: 'USER_BANNED',
    });
  }

  next();
};
