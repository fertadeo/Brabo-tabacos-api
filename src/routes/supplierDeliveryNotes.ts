import { Router } from 'express';
import { SupplierDeliveryNoteController } from '../controllers/supplierDeliveryNoteController';
import {
  createSupplierDeliveryNoteValidation,
  updateSupplierDeliveryNoteValidation,
  createSupplierDeliveryNoteItemValidation,
  updateSupplierDeliveryNoteItemValidation,
  linkInvoiceValidation
} from '../middleware/supplierDeliveryNoteValidation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const deliveryNoteController = new SupplierDeliveryNoteController();

// Apply JWT authentication to all delivery note routes
router.use(authenticateJWT);

/**
 * @route GET /api/supplier-delivery-notes
 * @desc Get all supplier delivery notes with pagination and filters
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/', authorizeRoles('gerencia', 'finanzas', 'logistica'), deliveryNoteController.getAllDeliveryNotes.bind(deliveryNoteController));

/**
 * @route GET /api/supplier-delivery-notes/:id
 * @desc Get delivery note by ID
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:id', authorizeRoles('gerencia', 'finanzas', 'logistica'), deliveryNoteController.getDeliveryNoteById.bind(deliveryNoteController));

/**
 * @route POST /api/supplier-delivery-notes
 * @desc Create new delivery note
 * @access Private (gerencia, finanzas, logistica)
 */
router.post('/', authorizeRoles('gerencia', 'finanzas', 'logistica'), createSupplierDeliveryNoteValidation, deliveryNoteController.createDeliveryNote.bind(deliveryNoteController));

/**
 * @route PUT /api/supplier-delivery-notes/:id
 * @desc Update delivery note
 * @access Private (gerencia, finanzas, logistica)
 */
router.put('/:id', authorizeRoles('gerencia', 'finanzas', 'logistica'), updateSupplierDeliveryNoteValidation, deliveryNoteController.updateDeliveryNote.bind(deliveryNoteController));

/**
 * @route DELETE /api/supplier-delivery-notes/:id
 * @desc Delete delivery note
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id', authorizeRoles('gerencia', 'finanzas'), deliveryNoteController.deleteDeliveryNote.bind(deliveryNoteController));

/**
 * @route POST /api/supplier-delivery-notes/:id/link-invoice
 * @desc Link invoice to delivery note
 * @access Private (gerencia, finanzas, logistica)
 */
router.post('/:id/link-invoice', authorizeRoles('gerencia', 'finanzas', 'logistica'), linkInvoiceValidation, deliveryNoteController.linkInvoice.bind(deliveryNoteController));

/**
 * @route GET /api/supplier-delivery-notes/:deliveryNoteId/items
 * @desc Get delivery note items
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:deliveryNoteId/items', authorizeRoles('gerencia', 'finanzas', 'logistica'), deliveryNoteController.getDeliveryNoteItems.bind(deliveryNoteController));

/**
 * @route POST /api/supplier-delivery-notes/:deliveryNoteId/items
 * @desc Create delivery note item
 * @access Private (gerencia, finanzas, logistica)
 */
router.post('/:deliveryNoteId/items', authorizeRoles('gerencia', 'finanzas', 'logistica'), createSupplierDeliveryNoteItemValidation, deliveryNoteController.createDeliveryNoteItem.bind(deliveryNoteController));

/**
 * @route PUT /api/supplier-delivery-notes/:deliveryNoteId/items/:itemId
 * @desc Update delivery note item
 * @access Private (gerencia, finanzas, logistica)
 */
router.put('/:deliveryNoteId/items/:itemId', authorizeRoles('gerencia', 'finanzas', 'logistica'), updateSupplierDeliveryNoteItemValidation, deliveryNoteController.updateDeliveryNoteItem.bind(deliveryNoteController));

/**
 * @route DELETE /api/supplier-delivery-notes/:deliveryNoteId/items/:itemId
 * @desc Delete delivery note item
 * @access Private (gerencia, finanzas)
 */
router.delete('/:deliveryNoteId/items/:itemId', authorizeRoles('gerencia', 'finanzas'), deliveryNoteController.deleteDeliveryNoteItem.bind(deliveryNoteController));

export default router;

