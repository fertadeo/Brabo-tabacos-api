import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PermissionRepository } from "../repositories/PermissionRepository";
import type { UserRole } from "../constants/roles";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";

export interface JWTUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTUser;
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing Authorization header" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: parseInt(decoded.sub, 10),
      username: decoded.username,
      role: decoded.role
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const authorizeRoles = (...roles: Array<JWTUser['role']>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    // Superadmin: acceso total a todos los módulos del ERP
    if (req.user.role === 'superadmin') {
      return next();
    }
    
    // Debug: Log para verificar rol del usuario y roles permitidos
    console.log(`[AUTH] Verificando autorización - Usuario rol: ${req.user.role}, Roles permitidos: ${roles.join(', ')}`);
    
    if (!roles.includes(req.user.role)) {
      console.log(`[AUTH] ❌ Acceso denegado - Usuario con rol "${req.user.role}" no tiene permisos. Roles requeridos: ${roles.join(', ')}`);
      return res.status(403).json({ success: false, message: "Forbidden: insufficient role" });
    }
    
    console.log(`[AUTH] ✅ Acceso permitido - Usuario con rol "${req.user.role}"`);
    return next();
  };
};

export const optionalAuthenticateJWT = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        id: parseInt(decoded.sub, 10),
        username: decoded.username,
        role: decoded.role
      };
    } catch (_err) {
      // ignore invalid token in optional mode
    }
  }
  return next();
};

/**
 * Middleware para verificar permisos granulares
 * @param permissionCodes - Array de códigos de permisos requeridos (OR logic: si tiene alguno, pasa)
 * @example authorizePermissions('products.create', 'products.update')
 */
export const authorizePermissions = (...permissionCodes: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: authentication required" 
      });
    }

    try {
      // Superadmin tiene acceso total sin verificar permisos granulares
      if (req.user.role === 'superadmin') {
        return next();
      }

      // Verificar si el usuario tiene alguno de los permisos requeridos
      let hasPermission = false;
      for (const permissionCode of permissionCodes) {
        const has = await PermissionRepository.getUserHasPermission(req.user.id, permissionCode);
        if (has) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        return res.status(403).json({ 
          success: false, 
          message: `Forbidden: se requiere uno de los siguientes permisos: ${permissionCodes.join(', ')}` 
        });
      }

      return next();
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: "Error al verificar permisos",
        error: error.message 
      });
    }
  };
};

/**
 * Middleware para verificar que el usuario tenga TODOS los permisos requeridos (AND logic)
 * @param permissionCodes - Array de códigos de permisos requeridos (AND logic: debe tener todos)
 * @example requireAllPermissions('products.view', 'products.update')
 */
export const requireAllPermissions = (...permissionCodes: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: authentication required" 
      });
    }

    try {
      if (req.user.role === 'superadmin') {
        return next();
      }

      // Verificar si el usuario tiene TODOS los permisos requeridos
      for (const permissionCode of permissionCodes) {
        const has = await PermissionRepository.getUserHasPermission(req.user.id, permissionCode);
        if (!has) {
          return res.status(403).json({ 
            success: false, 
            message: `Forbidden: se requiere el permiso: ${permissionCode}` 
          });
        }
      }

      return next();
    } catch (error: any) {
      return res.status(500).json({ 
        success: false, 
        message: "Error al verificar permisos",
        error: error.message 
      });
    }
  };
};
