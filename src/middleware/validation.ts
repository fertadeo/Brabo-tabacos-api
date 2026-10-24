import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../types';

/**
 * Middleware para normalizar nombres de campos del body
 * Convierte PascalCase y snake_case a camelCase para mantener consistencia
 */
export const normalizeUserFields = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    // Log para debugging (temporal)
    console.log('[NORMALIZE] Body original:', JSON.stringify(req.body, null, 2));
    
    // Normalizar firstName (acepta: firstName, FirstName, first_name)
    if (!req.body.firstName) {
      if (req.body.FirstName) {
        req.body.firstName = req.body.FirstName;
        console.log('[NORMALIZE] Convertido FirstName -> firstName');
      } else if (req.body.first_name) {
        req.body.firstName = req.body.first_name;
        console.log('[NORMALIZE] Convertido first_name -> firstName');
      }
    }
    
    // Normalizar lastName (acepta: lastName, LastName, last_name)
    if (!req.body.lastName) {
      if (req.body.LastName) {
        req.body.lastName = req.body.LastName;
        console.log('[NORMALIZE] Convertido LastName -> lastName');
      } else if (req.body.last_name) {
        req.body.lastName = req.body.last_name;
        console.log('[NORMALIZE] Convertido last_name -> lastName');
      }
    }
    
    // Normalizar isActive (acepta: isActive, is_active)
    if (req.body.is_active !== undefined && req.body.isActive === undefined) {
      req.body.isActive = req.body.is_active;
      console.log('[NORMALIZE] Convertido is_active -> isActive');
    }
    
    console.log('[NORMALIZE] Body normalizado:', JSON.stringify(req.body, null, 2));
  }
  next();
};

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log para debugging (temporal)
    console.log('[VALIDATION] Errores de validación encontrados:');
    errors.array().forEach((error, index) => {
      console.log(`  ${index + 1}. Campo: ${error.type === 'field' ? error.path : 'unknown'}, Mensaje: ${error.msg}`);
    });
    
    const response: ApiResponse = {
      success: false,
      message: 'Errores de validación',
      data: errors.array(),
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log('[VALIDATION] Iniciando validación...');
    console.log(`[VALIDATION] Número de validaciones: ${validations.length}`);
    const validationStart = Date.now();
    
    try {
      // Agregar timeout a la validación (30 segundos máximo)
      const validationPromise = Promise.all(validations.map((validation, index) => {
        console.log(`[VALIDATION] Ejecutando validación ${index + 1}/${validations.length}...`);
        return validation.run(req);
      }));
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout: La validación tomó más de 30 segundos'));
        }, 30000);
      });
      
      await Promise.race([validationPromise, timeoutPromise]);
      
      const validationDuration = Date.now() - validationStart;
      console.log(`[VALIDATION] Validación completada en ${validationDuration}ms`);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorList = errors.array();
        console.log('[VALIDATION] Errores encontrados:', errorList);
        const errorMessages = errorList.map((e: any) => e.msg || e.message).join(', ');
        const response: ApiResponse = {
          success: false,
          message: 'Errores de validación',
          error: errorMessages,
          data: errorList,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }
      
      console.log('[VALIDATION] Validación exitosa, pasando al siguiente middleware');
      next();
    } catch (error: any) {
      const validationDuration = Date.now() - validationStart;
      console.error(`[VALIDATION] Error durante validación (después de ${validationDuration}ms):`, error);
      console.error('[VALIDATION] Stack trace:', error.stack);
      const response: ApiResponse = {
        success: false,
        message: 'Error durante validación',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  };
};
