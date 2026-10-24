import { SupplierInvoiceRepository } from '../repositories/SupplierInvoiceRepository';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { SupplierAccountRepository } from '../repositories/SupplierAccountRepository';
import { executeQuery } from '../config/database';
import {
  SupplierInvoice,
  CreateSupplierInvoiceData,
  UpdateSupplierInvoiceData,
  SupplierInvoiceItem,
  CreateSupplierInvoiceItemData
} from '../entities/SupplierInvoice';

export class SupplierInvoiceService {
  private invoiceRepository: SupplierInvoiceRepository;
  private purchaseRepository: PurchaseRepository;
  private productRepository: ProductRepository;
  private accountRepository: SupplierAccountRepository;

  constructor() {
    this.invoiceRepository = new SupplierInvoiceRepository();
    this.purchaseRepository = new PurchaseRepository();
    this.productRepository = new ProductRepository();
    this.accountRepository = new SupplierAccountRepository();
  }

  // ========== INVOICE METHODS ==========

  async getAllInvoices(filters: {
    page?: number;
    limit?: number;
    search?: string;
    supplier_id?: number;
    purchase_id?: number;
    status?: string;
    payment_status?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return await this.invoiceRepository.getAllInvoices(filters);
  }

  async getInvoiceById(id: number): Promise<SupplierInvoice | null> {
    return await this.invoiceRepository.getInvoiceById(id);
  }

  async createInvoice(data: CreateSupplierInvoiceData, userId?: number): Promise<SupplierInvoice> {
    // Validate supplier exists and get supplier type
    const supplierQuery = `SELECT id, name, supplier_type FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [data.supplier_id]);
    
    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    const supplierType = supplier.supplier_type;

    // For productive suppliers, validate purchase exists
    if (supplierType === 'productivo') {
      if (!data.purchase_id) {
        throw new Error('Las facturas de proveedores productivos deben estar asociadas a una orden de compra');
      }

      const purchase = await this.purchaseRepository.getPurchaseById(data.purchase_id);
      if (!purchase) {
        throw new Error('Orden de compra no encontrada');
      }

      // Validate items have material_code for productive suppliers
      for (const item of data.items) {
        if (!item.material_code) {
          throw new Error('Los items de facturas de proveedores productivos deben tener código de material');
        }

        // Validate product exists if product_id is provided
        if (item.product_id) {
          const product = await this.productRepository.findById(item.product_id);
          if (!product) {
            throw new Error(`Producto con ID ${item.product_id} no encontrado`);
          }
        }
      }
    } else {
      // For non-productive suppliers, purchase_id is optional and material_code is optional
      if (data.purchase_id) {
        const purchase = await this.purchaseRepository.getPurchaseById(data.purchase_id);
        if (!purchase) {
          throw new Error('Orden de compra no encontrada');
        }
      }
    }

    // Calculate totals if not provided
    if (!data.subtotal || !data.total_amount) {
      const subtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unit_price;
        return sum + itemTotal;
      }, 0);

      const taxAmount = data.tax_amount || (subtotal * 0.21); // 21% IVA
      const totalAmount = subtotal + taxAmount;

      data.subtotal = subtotal;
      data.tax_amount = taxAmount;
      data.total_amount = totalAmount;
    }

    // Create invoice
    const invoice = await this.invoiceRepository.createInvoice(data, userId);

    // Create account movement for debt
    if (supplierType === 'productivo' || supplierType === 'no_productivo') {
      await this.accountRepository.createMovement({
        supplier_id: data.supplier_id,
        movement_type: 'debt',
        type: 'debit',
        amount: invoice.total_amount,
        reference_type: 'invoice',
        reference_id: invoice.id,
        due_date: invoice.due_date || undefined,
        status: 'pending',
        description: `Factura ${invoice.invoice_number}`
      });

      // Update account balances
      await this.accountRepository.updateAccountBalances(data.supplier_id);
    }

    return invoice;
  }

  async updateInvoice(id: number, data: UpdateSupplierInvoiceData): Promise<SupplierInvoice | null> {
    const existingInvoice = await this.invoiceRepository.getInvoiceById(id);
    if (!existingInvoice) {
      throw new Error('Factura no encontrada');
    }

    // Get supplier type
    const supplierQuery = `SELECT supplier_type FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [existingInvoice.supplier_id]);
    const supplierType = supplier?.supplier_type;

    // For productive suppliers, validate purchase_id if changing
    if (supplierType === 'productivo' && data.purchase_id !== undefined) {
      if (data.purchase_id && data.purchase_id !== existingInvoice.purchase_id) {
        const purchase = await this.purchaseRepository.getPurchaseById(data.purchase_id);
        if (!purchase) {
          throw new Error('Orden de compra no encontrada');
        }
      }
    }

    return await this.invoiceRepository.updateInvoice(id, data);
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const invoice = await this.invoiceRepository.getInvoiceById(id);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Check if invoice has payments
    const paymentsQuery = `SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?`;
    const [paymentsResult] = await executeQuery(paymentsQuery, [id]);

    if (paymentsResult?.count > 0) {
      throw new Error('No se puede eliminar una factura que tiene pagos asociados');
    }

    return await this.invoiceRepository.deleteInvoice(id);
  }

  async linkDeliveryNote(invoiceId: number, deliveryNoteId: number): Promise<SupplierInvoice | null> {
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Validate delivery note exists
    const deliveryNoteQuery = `SELECT id, supplier_id, purchase_id FROM supplier_delivery_notes WHERE id = ?`;
    const [deliveryNote] = await executeQuery(deliveryNoteQuery, [deliveryNoteId]);

    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    // Validate supplier matches
    if (deliveryNote.supplier_id !== invoice.supplier_id) {
      throw new Error('El remito pertenece a un proveedor diferente');
    }

    // Validate purchase matches (if both have purchase_id)
    if (invoice.purchase_id && deliveryNote.purchase_id && invoice.purchase_id !== deliveryNote.purchase_id) {
      throw new Error('El remito pertenece a una orden de compra diferente');
    }

    return await this.invoiceRepository.linkDeliveryNote(invoiceId, deliveryNoteId);
  }

  // ========== INVOICE ITEMS METHODS ==========

  async getInvoiceItems(invoiceId: number): Promise<SupplierInvoiceItem[]> {
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    return await this.invoiceRepository.getInvoiceItems(invoiceId);
  }

  async createInvoiceItem(invoiceId: number, data: CreateSupplierInvoiceItemData): Promise<SupplierInvoiceItem> {
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Get supplier type
    const supplierQuery = `SELECT supplier_type FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [invoice.supplier_id]);
    const supplierType = supplier?.supplier_type;

    // For productive suppliers, material_code is required
    if (supplierType === 'productivo' && !data.material_code) {
      throw new Error('Los items de facturas de proveedores productivos deben tener código de material');
    }

    // Validate product exists if product_id is provided
    if (data.product_id) {
      const product = await this.productRepository.findById(data.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${data.product_id} no encontrado`);
      }
    }

    // Create item
    const item = await this.invoiceRepository.createInvoiceItem(invoiceId, data);

    // Update invoice totals
    await this.updateInvoiceTotals(invoiceId);

    return item;
  }

  async updateInvoiceItem(
    invoiceId: number,
    itemId: number,
    data: Partial<CreateSupplierInvoiceItemData>
  ): Promise<SupplierInvoiceItem | null> {
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Get supplier type
    const supplierQuery = `SELECT supplier_type FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [invoice.supplier_id]);
    const supplierType = supplier?.supplier_type;

    // For productive suppliers, material_code is required if provided
    if (supplierType === 'productivo' && data.material_code === '') {
      throw new Error('Los items de facturas de proveedores productivos deben tener código de material');
    }

    // Validate product exists if product_id is being changed
    if (data.product_id) {
      const product = await this.productRepository.findById(data.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${data.product_id} no encontrado`);
      }
    }

    const item = await this.invoiceRepository.updateInvoiceItem(invoiceId, itemId, data);

    // Update invoice totals
    await this.updateInvoiceTotals(invoiceId);

    return item;
  }

  async deleteInvoiceItem(invoiceId: number, itemId: number): Promise<boolean> {
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    const deleted = await this.invoiceRepository.deleteInvoiceItem(invoiceId, itemId);

    if (deleted) {
      // Update invoice totals
      await this.updateInvoiceTotals(invoiceId);
    }

    return deleted;
  }

  // Helper method to update invoice totals
  private async updateInvoiceTotals(invoiceId: number): Promise<void> {
    const items = await this.invoiceRepository.getInvoiceItems(invoiceId);
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);

    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) return;

    const taxAmount = invoice.tax_amount || (subtotal * 0.21); // 21% IVA
    const totalAmount = subtotal + taxAmount;

    await this.invoiceRepository.updateInvoice(invoiceId, {
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount
    });
  }
}

