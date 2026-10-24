import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/userController';
import { body, param, query } from 'express-validator';
import { handleValidationErrors, normalizeUserFields } from '../middleware/validation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { ASSIGNABLE_ROLES } from '../constants/roles';

const router = Router();
const userController = new UserController();

// GET /api/users - Obtener todos los usuarios
router.get(
  '/',
  authenticateJWT, // Requiere autenticación
  authorizeRoles('admin', 'gerencia'), // Solo admin y gerencia pueden ver usuarios
  query('is_active').optional().isBoolean(),
  query('role').optional().isString(),
  handleValidationErrors,
  (req: Request, res: Response) => userController.getAllUsers(req as any, res)
);

// GET /api/users/:id - Obtener usuario por ID
router.get(
  '/:id',
  authenticateJWT, // Requiere autenticación
  authorizeRoles('admin', 'gerencia'), // Solo admin y gerencia pueden ver usuarios
  param('id').isInt({ min: 1 }),
  handleValidationErrors,
  (req: Request, res: Response) => userController.getUserById(req as any, res)
);

// POST /api/users - Crear nuevo usuario
// Permite crear usuarios sin autenticación (público)
router.post(
  '/',
  normalizeUserFields, // Normalizar campos antes de validar
  body('username').notEmpty().withMessage('username es requerido'),
  body('email').isEmail().withMessage('email debe ser válido'),
  body('password').isLength({ min: 6 }).withMessage('password debe tener al menos 6 caracteres'),
  body('firstName').notEmpty().withMessage('firstName es requerido (acepta firstName, FirstName o first_name)'),
  body('lastName').notEmpty().withMessage('lastName es requerido (acepta lastName, LastName o last_name)'),
  body('role').isIn([...ASSIGNABLE_ROLES]).withMessage('role inválido'),
  body('isActive').optional().isBoolean(),
  handleValidationErrors,
  (req: Request, res: Response) => userController.createUser(req as any, res)
);

// PUT /api/users/:id - Actualizar usuario
router.put(
  '/:id',
  authenticateJWT, // Requiere autenticación
  authorizeRoles('admin', 'gerencia'), // Solo admin y gerencia pueden actualizar usuarios
  normalizeUserFields, // Normalizar campos antes de validar
  param('id').isInt({ min: 1 }),
  body('username').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('role').optional().isIn([...ASSIGNABLE_ROLES]),
  body('isActive').optional().isBoolean(),
  handleValidationErrors,
  (req: Request, res: Response) => userController.updateUser(req as any, res)
);

// DELETE /api/users/:id - Eliminar usuario (soft delete)
router.delete(
  '/:id',
  authenticateJWT, // Requiere autenticación
  authorizeRoles('admin', 'gerencia'), // Solo admin y gerencia pueden eliminar usuarios
  param('id').isInt({ min: 1 }),
  handleValidationErrors,
  (req: Request, res: Response) => userController.deleteUser(req as any, res)
);

export default router;

