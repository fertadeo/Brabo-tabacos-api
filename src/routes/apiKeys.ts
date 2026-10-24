import { Router, Request, Response, NextFunction } from 'express';
import { ApiKeyController } from '../controllers/apiKeyController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';

const router = Router();
const apiKeyController = new ApiKeyController();

// Validación para crear API Key
const createApiKeyValidation = [
  body('key_name')
    .notEmpty()
    .withMessage('El nombre de la API Key es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('expires_at')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // Permitir null/undefined/empty
      }
      // Si hay un valor, debe ser una fecha ISO 8601 válida
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .withMessage('La fecha de expiración debe ser válida (ISO 8601) o null'),
  body('rate_limit_per_minute')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El límite por minuto debe ser un entero positivo'),
  body('rate_limit_per_hour')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El límite por hora debe ser un entero positivo'),
  body('allowed_ips')
    .optional()
    .isString()
    .withMessage('Las IPs permitidas deben ser una cadena de texto'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Los metadatos deben ser un objeto JSON')
];

// Validación para actualizar API Key
const updateApiKeyValidation = [
  param('id')
    .isInt()
    .withMessage('ID debe ser un número entero'),
  body('key_name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un booleano'),
  body('expires_at')
    .optional()
    .isISO8601()
    .withMessage('La fecha de expiración debe ser válida (ISO 8601)'),
  body('rate_limit_per_minute')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El límite por minuto debe ser un entero positivo'),
  body('rate_limit_per_hour')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El límite por hora debe ser un entero positivo')
];

// Validación para parámetros de ID
const idValidation = [
  param('id')
    .isInt()
    .withMessage('ID debe ser un número entero')
];

// Todas las rutas requieren autenticación JWT
router.use(authenticateJWT);

// Solo administradores y gerencia pueden gestionar API Keys
router.use(authorizeRoles('admin', 'gerencia'));

// GET /api/api-keys - Listar todas las API Keys
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page debe ser un entero positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit debe ser entre 1 y 100'),
    query('is_active').optional().isBoolean().withMessage('is_active debe ser un booleano'),
    query('search').optional().isString().withMessage('search debe ser una cadena de texto')
  ],
  validate,
  (req: Request, res: Response) => apiKeyController.getAllApiKeys(req as any, res)
);

// GET /api/api-keys/:id - Obtener una API Key por ID
router.get(
  '/:id',
  idValidation,
  validate,
  (req: Request, res: Response) => apiKeyController.getApiKeyById(req as any, res)
);

// POST /api/api-keys - Crear una nueva API Key
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    console.log('[API_KEY_ROUTE] POST /api/api-keys recibido');
    console.log('[API_KEY_ROUTE] Body recibido:', JSON.stringify(req.body));
    next();
  },
  createApiKeyValidation,
  validate,
  (req: Request, res: Response) => {
    console.log('[API_KEY_ROUTE] Pasando al controller...');
    apiKeyController.createApiKey(req as any, res).catch((error: any) => {
      console.error('[API_KEY_ROUTE] Error no capturado en controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }
);

// PUT /api/api-keys/:id - Actualizar una API Key
router.put(
  '/:id',
  updateApiKeyValidation,
  validate,
  (req: Request, res: Response) => apiKeyController.updateApiKey(req as any, res)
);

// DELETE /api/api-keys/:id - Desactivar una API Key (soft delete)
router.delete(
  '/:id',
  idValidation,
  validate,
  (req: Request, res: Response) => apiKeyController.deactivateApiKey(req as any, res)
);

// PUT /api/api-keys/:id/activate - Activar una API Key
router.put(
  '/:id/activate',
  idValidation,
  validate,
  (req: Request, res: Response) => apiKeyController.activateApiKey(req as any, res)
);

// DELETE /api/api-keys/:id/permanent - Eliminar permanentemente una API Key
router.delete(
  '/:id/permanent',
  idValidation,
  validate,
  (req: Request, res: Response) => apiKeyController.deleteApiKey(req as any, res)
);

export default router;


