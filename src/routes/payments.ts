import { Router } from 'express';
import PaymentsController from '../controllers/paymentsController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();

// Requiere autenticación
router.use(authenticateJWT);

// Roles típicos para finanzas
const roles = ['admin', 'manager', 'finanzas', 'gerencia'] as const;

// Listar pagos con filtros y paginación
router.get('/', authorizeRoles(...roles), (req, res) => PaymentsController.list(req, res));

// Obtener pago por id
router.get('/:id', authorizeRoles(...roles), (req, res) => PaymentsController.getById(req, res));

// Crear pago
router.post('/', authorizeRoles(...roles), (req, res) => PaymentsController.create(req, res));

// Actualizar pago
router.put('/:id', authorizeRoles(...roles), (req, res) => PaymentsController.update(req, res));

// Eliminar pago
router.delete('/:id', authorizeRoles(...roles), (req, res) => PaymentsController.remove(req, res));

export default router;
