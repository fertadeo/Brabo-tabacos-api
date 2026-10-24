import { Request, Response, NextFunction } from 'express';
import { optionalAuthenticateJWT, AuthenticatedRequest } from './jwt';
import { ActivityLoggerService } from '../services/ActivityLoggerService';

/**
 * Registra movimientos importantes (POST/PUT/PATCH/DELETE) al finalizar la respuesta.
 * Usa optionalAuthenticateJWT para capturar usuario cuando hay token.
 */
export function activityLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  optionalAuthenticateJWT(req as AuthenticatedRequest, res, () => {
    const path = req.originalUrl || req.url;
    const method = req.method;

    if (!ActivityLoggerService.shouldLogRequest(method, path)) {
      next();
      return;
    }

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const authReq = req as AuthenticatedRequest;
      const statusCode = res.statusCode;
      const message = ActivityLoggerService.buildActivityMessage(
        method,
        path,
        statusCode,
        authReq.user?.username
      );

      const base = ActivityLoggerService.fromRequest(authReq, {
        event_type: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'alert' : 'activity',
        severity: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info',
        module: path.match(/^\/api\/([^/?]+)/)?.[1] ?? 'system',
        action: method.toLowerCase(),
        message,
        status_code: statusCode,
        duration_ms: duration,
      });

      ActivityLoggerService.logAsync(base);
    });

    next();
  });
}
