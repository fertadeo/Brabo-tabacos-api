import { Router } from 'express';
import { SupplierAccountController } from '../controllers/supplierAccountController';
import {
  getSupplierAccountValidation,
  updateCreditLimitValidation,
  getMovementsValidation,
  createMovementValidation,
  updateMovementValidation,
  syncAccountBalancesValidation
} from '../middleware/supplierAccountValidation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const accountController = new SupplierAccountController();

// Apply JWT authentication to all account routes
router.use(authenticateJWT);

/**
 * @route GET /api/supplier-accounts/:supplierId
 * @desc Get account by supplier ID
 * @access Private (gerencia, finanzas)
 */
router.get('/:supplierId', authorizeRoles('gerencia', 'finanzas'), getSupplierAccountValidation, accountController.getAccountBySupplierId.bind(accountController));

/**
 * @route GET /api/supplier-accounts/:supplierId/summary
 * @desc Get account summary with movements
 * @access Private (gerencia, finanzas)
 */
router.get('/:supplierId/summary', authorizeRoles('gerencia', 'finanzas'), getSupplierAccountValidation, accountController.getAccountSummary.bind(accountController));

/**
 * @route PUT /api/supplier-accounts/:supplierId/credit-limit
 * @desc Update credit limit
 * @access Private (gerencia, finanzas)
 */
router.put('/:supplierId/credit-limit', authorizeRoles('gerencia', 'finanzas'), updateCreditLimitValidation, accountController.updateCreditLimit.bind(accountController));

/**
 * @route POST /api/supplier-accounts/:supplierId/sync
 * @desc Sync account balances
 * @access Private (gerencia, finanzas)
 */
router.post('/:supplierId/sync', authorizeRoles('gerencia', 'finanzas'), syncAccountBalancesValidation, accountController.syncAccountBalances.bind(accountController));

/**
 * @route GET /api/supplier-accounts/:supplierId/movements
 * @desc Get account movements
 * @access Private (gerencia, finanzas)
 */
router.get('/:supplierId/movements', authorizeRoles('gerencia', 'finanzas'), getMovementsValidation, accountController.getMovements.bind(accountController));

/**
 * @route GET /api/supplier-accounts/movements/:movementId
 * @desc Get movement by ID
 * @access Private (gerencia, finanzas)
 */
router.get('/movements/:movementId', authorizeRoles('gerencia', 'finanzas'), accountController.getMovementById.bind(accountController));

/**
 * @route POST /api/supplier-accounts/movements
 * @desc Create movement
 * @access Private (gerencia, finanzas)
 */
router.post('/movements', authorizeRoles('gerencia', 'finanzas'), createMovementValidation, accountController.createMovement.bind(accountController));

/**
 * @route PUT /api/supplier-accounts/movements/:movementId
 * @desc Update movement
 * @access Private (gerencia, finanzas)
 */
router.put('/movements/:movementId', authorizeRoles('gerencia', 'finanzas'), updateMovementValidation, accountController.updateMovement.bind(accountController));

/**
 * @route DELETE /api/supplier-accounts/movements/:movementId
 * @desc Delete movement
 * @access Private (gerencia, finanzas)
 */
router.delete('/movements/:movementId', authorizeRoles('gerencia', 'finanzas'), accountController.deleteMovement.bind(accountController));

export default router;

