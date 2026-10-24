import { Router } from 'express';
import { SupplierInvoiceController } from '../controllers/supplierInvoiceController';
import {
  createSupplierInvoiceValidation,
  updateSupplierInvoiceValidation,
  createSupplierInvoiceItemValidation,
  updateSupplierInvoiceItemValidation,
  linkDeliveryNoteValidation
} from '../middleware/supplierInvoiceValidation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const invoiceController = new SupplierInvoiceController();

// Apply JWT authentication to all invoice routes
router.use(authenticateJWT);

/**
 * @route GET /api/supplier-invoices
 * @desc Get all supplier invoices with pagination and filters
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/', authorizeRoles('gerencia', 'finanzas', 'logistica'), invoiceController.getAllInvoices.bind(invoiceController));

/**
 * @route GET /api/supplier-invoices/:id
 * @desc Get invoice by ID
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:id', authorizeRoles('gerencia', 'finanzas', 'logistica'), invoiceController.getInvoiceById.bind(invoiceController));

/**
 * @route POST /api/supplier-invoices
 * @desc Create new invoice
 * @access Private (gerencia, finanzas)
 */
router.post('/', authorizeRoles('gerencia', 'finanzas'), createSupplierInvoiceValidation, invoiceController.createInvoice.bind(invoiceController));

/**
 * @route PUT /api/supplier-invoices/:id
 * @desc Update invoice
 * @access Private (gerencia, finanzas)
 */
router.put('/:id', authorizeRoles('gerencia', 'finanzas'), updateSupplierInvoiceValidation, invoiceController.updateInvoice.bind(invoiceController));

/**
 * @route DELETE /api/supplier-invoices/:id
 * @desc Delete invoice
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id', authorizeRoles('gerencia', 'finanzas'), invoiceController.deleteInvoice.bind(invoiceController));

/**
 * @route POST /api/supplier-invoices/:id/link-delivery-note
 * @desc Link delivery note to invoice
 * @access Private (gerencia, finanzas, logistica)
 */
router.post('/:id/link-delivery-note', authorizeRoles('gerencia', 'finanzas', 'logistica'), linkDeliveryNoteValidation, invoiceController.linkDeliveryNote.bind(invoiceController));

/**
 * @route GET /api/supplier-invoices/:invoiceId/items
 * @desc Get invoice items
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:invoiceId/items', authorizeRoles('gerencia', 'finanzas', 'logistica'), invoiceController.getInvoiceItems.bind(invoiceController));

/**
 * @route POST /api/supplier-invoices/:invoiceId/items
 * @desc Create invoice item
 * @access Private (gerencia, finanzas)
 */
router.post('/:invoiceId/items', authorizeRoles('gerencia', 'finanzas'), createSupplierInvoiceItemValidation, invoiceController.createInvoiceItem.bind(invoiceController));

/**
 * @route PUT /api/supplier-invoices/:invoiceId/items/:itemId
 * @desc Update invoice item
 * @access Private (gerencia, finanzas)
 */
router.put('/:invoiceId/items/:itemId', authorizeRoles('gerencia', 'finanzas'), updateSupplierInvoiceItemValidation, invoiceController.updateInvoiceItem.bind(invoiceController));

/**
 * @route DELETE /api/supplier-invoices/:invoiceId/items/:itemId
 * @desc Delete invoice item
 * @access Private (gerencia, finanzas)
 */
router.delete('/:invoiceId/items/:itemId', authorizeRoles('gerencia', 'finanzas'), invoiceController.deleteInvoiceItem.bind(invoiceController));

export default router;

