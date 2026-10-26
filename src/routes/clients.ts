import { Router } from 'express';
import { ClientController } from '../controllers/clientController';
import { createClientValidation, updateClientValidation } from '../middleware/clientValidation';
import { authenticateJWT, authorizeRoles, AuthenticatedRequest } from '../middleware/jwt';
import { validate } from '../middleware/validation';
import { padronCuitParam } from '../middleware/padronValidation';
import { NextFunction, Response } from 'express';

const router = Router();
const clientController = new ClientController();

/** Lectura: alineado al menú ERP (admin ve Clientes) + logística (reparto). */
const CLIENT_VIEW = ['admin', 'gerencia', 'ventas', 'finanzas', 'logistica', 'manager'] as const;
/** Alta / edición / baja */
const CLIENT_MANAGE = ['admin', 'gerencia', 'ventas'] as const;

/** Aliases del frontend Next.js → snake_case de la API. */
const normalizeClientBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.body || (req.method !== 'POST' && req.method !== 'PUT')) {
    return next();
  }
  const b = req.body;
  if (b.person_type !== undefined && b.personeria === undefined) {
    req.body.personeria = b.person_type;
  }
  if (b.primary_tax_id !== undefined && b.cuil_cuit === undefined) {
    req.body.cuil_cuit = b.primary_tax_id;
  }
  if (b.taxCondition !== undefined && b.tax_condition === undefined) {
    req.body.tax_condition = b.taxCondition;
  }
  if (b.condicionIvaReceptor !== undefined && b.condicion_iva_receptor === undefined) {
    req.body.condicion_iva_receptor = b.condicionIvaReceptor;
  }
  next();
};

router.use(authenticateJWT);

/**
 * @route GET /api/clients
 */
router.get('/', authorizeRoles(...CLIENT_VIEW), clientController.getAllClients.bind(clientController));

/**
 * @route GET /api/clients/stats
 */
router.get('/stats', authorizeRoles(...CLIENT_VIEW), clientController.getClientStats.bind(clientController));

/**
 * @route GET /api/clients/padron/:cuit
 */
router.get(
  '/padron/:cuit',
  authorizeRoles(...CLIENT_MANAGE),
  validate(padronCuitParam),
  clientController.lookupPadron.bind(clientController)
);

/**
 * @route GET /api/clients/:id
 */
router.get('/:id', authorizeRoles(...CLIENT_VIEW), clientController.getClientById.bind(clientController));

/**
 * @route POST /api/clients
 */
router.post(
  '/',
  authorizeRoles(...CLIENT_MANAGE),
  normalizeClientBody,
  createClientValidation,
  clientController.createClient.bind(clientController)
);

/**
 * @route PUT /api/clients/:id
 */
router.put(
  '/:id',
  authorizeRoles(...CLIENT_MANAGE),
  normalizeClientBody,
  updateClientValidation,
  clientController.updateClient.bind(clientController)
);

/**
 * @route DELETE /api/clients/:id
 */
router.delete('/:id', authorizeRoles(...CLIENT_MANAGE), clientController.deleteClient.bind(clientController));

export default router;
