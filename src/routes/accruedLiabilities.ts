import { Router } from 'express';
import { AccruedLiabilityController } from '../controllers/accruedLiabilityController';
import {
  createAccruedLiabilityValidation,
  updateAccruedLiabilityValidation,
  linkPaymentToLiabilityValidation,
  unlinkPaymentFromLiabilityValidation
} from '../middleware/accruedLiabilityValidation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const liabilityController = new AccruedLiabilityController();

// Apply JWT authentication to all liability routes
router.use(authenticateJWT);

/**
 * @route GET /api/accrued-liabilities
 * @desc Get all accrued liabilities with pagination and filters
 * @access Private (gerencia, finanzas)
 */
router.get('/', authorizeRoles('gerencia', 'finanzas'), liabilityController.getAllLiabilities.bind(liabilityController));

/**
 * @route GET /api/accrued-liabilities/:id
 * @desc Get liability by ID
 * @access Private (gerencia, finanzas)
 */
router.get('/:id', authorizeRoles('gerencia', 'finanzas'), liabilityController.getLiabilityById.bind(liabilityController));

/**
 * @route POST /api/accrued-liabilities
 * @desc Create new liability
 * @access Private (gerencia, finanzas)
 */
router.post('/', authorizeRoles('gerencia', 'finanzas'), createAccruedLiabilityValidation, liabilityController.createLiability.bind(liabilityController));

/**
 * @route PUT /api/accrued-liabilities/:id
 * @desc Update liability
 * @access Private (gerencia, finanzas)
 */
router.put('/:id', authorizeRoles('gerencia', 'finanzas'), updateAccruedLiabilityValidation, liabilityController.updateLiability.bind(liabilityController));

/**
 * @route DELETE /api/accrued-liabilities/:id
 * @desc Delete liability
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id', authorizeRoles('gerencia', 'finanzas'), liabilityController.deleteLiability.bind(liabilityController));

/**
 * @route GET /api/accrued-liabilities/:id/payments
 * @desc Get liability payments
 * @access Private (gerencia, finanzas)
 */
router.get('/:id/payments', authorizeRoles('gerencia', 'finanzas'), liabilityController.getLiabilityPayments.bind(liabilityController));

/**
 * @route POST /api/accrued-liabilities/:id/link-payment
 * @desc Link payment to liability
 * @access Private (gerencia, finanzas)
 */
router.post('/:id/link-payment', authorizeRoles('gerencia', 'finanzas'), linkPaymentToLiabilityValidation, liabilityController.linkPaymentToLiability.bind(liabilityController));

/**
 * @route DELETE /api/accrued-liabilities/:id/payments/:paymentId
 * @desc Unlink payment from liability
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id/payments/:paymentId', authorizeRoles('gerencia', 'finanzas'), unlinkPaymentFromLiabilityValidation, liabilityController.unlinkPaymentFromLiability.bind(liabilityController));

export default router;

