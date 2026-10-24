import { executeQuery, getConnection } from '../config/database';
import type { PoolConnection } from 'mysql2/promise';
import {
  SupplierInvoice,
  CreateSupplierInvoiceData,
  UpdateSupplierInvoiceData,
  SupplierInvoiceItem,
  CreateSupplierInvoiceItemData,
  UpdateSupplierInvoiceItemData
} from '../entities/SupplierInvoice';

export class SupplierInvoiceRepository {
  
  // ========== INVOICE METHODS ==========
  
  // Get all invoices with pagination and filters
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
  } = {}): Promise<{ invoices: SupplierInvoice[]; total: number }> {
    const { page = 1, limit = 10, search, supplier_id, purchase_id, status, payment_status, date_from, date_to } = filters;
    const offset = (page - 1) * limit;
    
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(si.invoice_number LIKE ? OR s.name LIKE ? OR si.notes LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (supplier_id) {
      whereConditions.push('si.supplier_id = ?');
      queryParams.push(supplier_id);
    }
    
    if (purchase_id) {
      whereConditions.push('si.purchase_id = ?');
      queryParams.push(purchase_id);
    }
    
    if (status) {
      whereConditions.push('si.status = ?');
      queryParams.push(status);
    }
    
    if (payment_status) {
      whereConditions.push('si.payment_status = ?');
      queryParams.push(payment_status);
    }
    
    if (date_from) {
      whereConditions.push('DATE(si.invoice_date) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(si.invoice_date) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM supplier_invoices si
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get invoices with related info
    const selectQuery = `
      SELECT 
        si.id,
        si.invoice_number,
        si.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        si.purchase_id,
        p.purchase_number,
        si.invoice_date,
        si.due_date,
        si.subtotal,
        si.tax_amount,
        si.total_amount,
        si.status,
        si.payment_status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (si.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        si.delivery_note_id,
        dn.delivery_note_number,
        si.notes,
        si.file_url,
        si.created_by,
        si.created_at,
        si.updated_at
      FROM supplier_invoices si
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      LEFT JOIN purchases p ON si.purchase_id = p.id
      LEFT JOIN supplier_delivery_notes dn ON si.delivery_note_id = dn.id
      ${whereClause}
      ORDER BY si.invoice_date DESC, si.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const invoices = await executeQuery(selectQuery, [...queryParams, limit, offset]);
    
    return { invoices, total };
  }
  
  // Get invoice by ID
  async getInvoiceById(id: number, connection?: PoolConnection): Promise<SupplierInvoice | null> {
    const query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        si.purchase_id,
        p.purchase_number,
        si.invoice_date,
        si.due_date,
        si.subtotal,
        si.tax_amount,
        si.total_amount,
        si.status,
        si.payment_status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (si.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        si.delivery_note_id,
        dn.delivery_note_number,
        si.notes,
        si.file_url,
        si.created_by,
        si.created_at,
        si.updated_at
      FROM supplier_invoices si
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      LEFT JOIN purchases p ON si.purchase_id = p.id
      LEFT JOIN supplier_delivery_notes dn ON si.delivery_note_id = dn.id
      WHERE si.id = ?
    `;
    
    const [invoice] = await executeQuery(query, [id], connection);
    return invoice || null;
  }
  
  // Get invoice by invoice number
  async getInvoiceByNumber(invoiceNumber: string, connection?: PoolConnection): Promise<SupplierInvoice | null> {
    const query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        si.purchase_id,
        p.purchase_number,
        si.invoice_date,
        si.due_date,
        si.subtotal,
        si.tax_amount,
        si.total_amount,
        si.status,
        si.payment_status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (si.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        si.delivery_note_id,
        dn.delivery_note_number,
        si.notes,
        si.file_url,
        si.created_by,
        si.created_at,
        si.updated_at
      FROM supplier_invoices si
      LEFT JOIN suppliers s ON si.supplier_id = s.id
      LEFT JOIN purchases p ON si.purchase_id = p.id
      LEFT JOIN supplier_delivery_notes dn ON si.delivery_note_id = dn.id
      WHERE si.invoice_number = ?
    `;
    
    const [invoice] = await executeQuery(query, [invoiceNumber], connection);
    return invoice || null;
  }
  
  // Create new invoice
  async createInvoice(data: CreateSupplierInvoiceData, userId?: number): Promise<SupplierInvoice> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if invoice number already exists
      const existingInvoice = await this.getInvoiceByNumber(data.invoice_number, connection);
      if (existingInvoice) {
        throw new Error(`Ya existe una factura con el número ${data.invoice_number}`);
      }
      
      // Insert invoice
      const insertQuery = `
        INSERT INTO supplier_invoices (
          invoice_number, supplier_id, purchase_id, invoice_date, due_date,
          subtotal, tax_amount, total_amount, status, payment_status, notes, file_url, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', 'pending', ?, ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        data.invoice_number,
        data.supplier_id,
        data.purchase_id || null,
        data.invoice_date,
        data.due_date || null,
        data.subtotal,
        data.tax_amount || 0,
        data.total_amount,
        data.notes || null,
        data.file_url || null,
        userId || null
      ], connection);
      
      const invoiceId = result.insertId;
      
      // Insert invoice items
      for (const item of data.items) {
        await this.createInvoiceItem(invoiceId, item, connection);
      }
      
      // Update payment status based on items
      await this.updateInvoicePaymentStatus(invoiceId, connection);
      
      await connection.commit();
      
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Error creating invoice');
      }
      
      return invoice;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Update invoice
  async updateInvoice(id: number, data: UpdateSupplierInvoiceData): Promise<SupplierInvoice | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.invoice_number !== undefined) {
      // Check if new invoice number already exists (excluding current invoice)
      const existingInvoice = await this.getInvoiceByNumber(data.invoice_number);
      if (existingInvoice && existingInvoice.id !== id) {
        throw new Error(`Ya existe una factura con el número ${data.invoice_number}`);
      }
      updateFields.push('invoice_number = ?');
      updateValues.push(data.invoice_number);
    }
    
    if (data.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?');
      updateValues.push(data.supplier_id);
    }
    
    if (data.purchase_id !== undefined) {
      updateFields.push('purchase_id = ?');
      updateValues.push(data.purchase_id);
    }
    
    if (data.invoice_date !== undefined) {
      updateFields.push('invoice_date = ?');
      updateValues.push(data.invoice_date);
    }
    
    if (data.due_date !== undefined) {
      updateFields.push('due_date = ?');
      updateValues.push(data.due_date);
    }
    
    if (data.subtotal !== undefined) {
      updateFields.push('subtotal = ?');
      updateValues.push(data.subtotal);
    }
    
    if (data.tax_amount !== undefined) {
      updateFields.push('tax_amount = ?');
      updateValues.push(data.tax_amount);
    }
    
    if (data.total_amount !== undefined) {
      updateFields.push('total_amount = ?');
      updateValues.push(data.total_amount);
    }
    
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(data.status);
    }
    
    if (data.payment_status !== undefined) {
      updateFields.push('payment_status = ?');
      updateValues.push(data.payment_status);
    }
    
    if (data.delivery_note_id !== undefined) {
      updateFields.push('delivery_note_id = ?');
      updateValues.push(data.delivery_note_id);
    }
    
    if (data.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(data.notes);
    }
    
    if (data.file_url !== undefined) {
      updateFields.push('file_url = ?');
      updateValues.push(data.file_url);
    }
    
    if (updateFields.length === 0) {
      return await this.getInvoiceById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE supplier_invoices SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    // Update payment status
    await this.updateInvoicePaymentStatus(id);
    
    return await this.getInvoiceById(id);
  }
  
  // Delete invoice
  async deleteInvoice(id: number): Promise<boolean> {
    const invoice = await this.getInvoiceById(id);
    if (!invoice) {
      return false;
    }
    
    // Check if invoice has payments
    const paymentsQuery = `SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?`;
    const [paymentsResult] = await executeQuery(paymentsQuery, [id]);
    
    if (paymentsResult?.count > 0) {
      throw new Error('No se puede eliminar una factura que tiene pagos asociados');
    }
    
    const deleteQuery = `DELETE FROM supplier_invoices WHERE id = ?`;
    await executeQuery(deleteQuery, [id]);
    
    return true;
  }
  
  // Link delivery note to invoice
  async linkDeliveryNote(invoiceId: number, deliveryNoteId: number): Promise<SupplierInvoice | null> {
    const updateQuery = `UPDATE supplier_invoices SET delivery_note_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeQuery(updateQuery, [deliveryNoteId, invoiceId]);
    
    // Update matches_invoice in delivery note
    await executeQuery(
      `UPDATE supplier_delivery_notes SET matches_invoice = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [deliveryNoteId]
    );
    
    return await this.getInvoiceById(invoiceId);
  }
  
  // Update invoice payment status based on payments
  private async updateInvoicePaymentStatus(invoiceId: number, connection?: PoolConnection): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId, connection);
    if (!invoice) return;
    
    const paidAmount = invoice.paid_amount || 0;
    const totalAmount = invoice.total_amount;
    
    let paymentStatus: string;
    let status: string;
    
    if (paidAmount <= 0) {
      paymentStatus = 'pending';
      status = invoice.status === 'draft' ? 'draft' : 'received';
    } else if (paidAmount >= totalAmount) {
      paymentStatus = 'paid';
      status = 'paid';
    } else {
      paymentStatus = 'partial';
      status = 'partial_paid';
    }
    
    // Check if overdue
    if (paymentStatus === 'pending' && invoice.due_date) {
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        paymentStatus = 'overdue';
      }
    }
    
    await executeQuery(
      `UPDATE supplier_invoices SET payment_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [paymentStatus, status, invoiceId],
      connection
    );
  }
  
  // ========== INVOICE ITEMS METHODS ==========
  
  // Get invoice items by invoice ID
  async getInvoiceItems(invoiceId: number, connection?: PoolConnection): Promise<SupplierInvoiceItem[]> {
    const query = `
      SELECT 
        sii.id,
        sii.invoice_id,
        sii.material_code,
        sii.product_id,
        p.name as product_name,
        p.code as product_code,
        sii.description,
        sii.quantity,
        sii.unit_price,
        sii.total_price,
        sii.unit_cost,
        sii.affects_production_cost,
        sii.purchase_item_id,
        sii.created_at
      FROM supplier_invoice_items sii
      LEFT JOIN products p ON sii.product_id = p.id
      WHERE sii.invoice_id = ?
      ORDER BY sii.created_at ASC
    `;
    
    return await executeQuery(query, [invoiceId], connection);
  }
  
  // Get invoice item by ID
  async getInvoiceItemById(itemId: number, connection?: PoolConnection): Promise<SupplierInvoiceItem | null> {
    const query = `
      SELECT 
        sii.id,
        sii.invoice_id,
        sii.material_code,
        sii.product_id,
        p.name as product_name,
        p.code as product_code,
        sii.description,
        sii.quantity,
        sii.unit_price,
        sii.total_price,
        sii.unit_cost,
        sii.affects_production_cost,
        sii.purchase_item_id,
        sii.created_at
      FROM supplier_invoice_items sii
      LEFT JOIN products p ON sii.product_id = p.id
      WHERE sii.id = ?
    `;
    
    const [item] = await executeQuery(query, [itemId], connection);
    return item || null;
  }
  
  // Create invoice item
  async createInvoiceItem(
    invoiceId: number,
    data: CreateSupplierInvoiceItemData,
    connection?: PoolConnection
  ): Promise<SupplierInvoiceItem> {
    const totalPrice = data.quantity * data.unit_price;
    
    const insertQuery = `
      INSERT INTO supplier_invoice_items (
        invoice_id, material_code, product_id, description, quantity,
        unit_price, total_price, unit_cost, affects_production_cost, purchase_item_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      invoiceId,
      data.material_code || null,
      data.product_id || null,
      data.description,
      data.quantity,
      data.unit_price,
      totalPrice,
      data.unit_cost || null,
      data.affects_production_cost !== undefined ? data.affects_production_cost : true,
      data.purchase_item_id || null
    ], connection);
    
    const item = await this.getInvoiceItemById(result.insertId, connection);
    if (!item) {
      throw new Error('Error creando el item de factura');
    }
    
    return item;
  }
  
  // Update invoice item
  async updateInvoiceItem(
    invoiceId: number,
    itemId: number,
    data: UpdateSupplierInvoiceItemData,
    connection?: PoolConnection
  ): Promise<SupplierInvoiceItem | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.material_code !== undefined) {
      updateFields.push('material_code = ?');
      updateValues.push(data.material_code);
    }
    
    if (data.product_id !== undefined) {
      updateFields.push('product_id = ?');
      updateValues.push(data.product_id);
    }
    
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(data.description);
    }
    
    if (data.quantity !== undefined) {
      updateFields.push('quantity = ?');
      updateValues.push(data.quantity);
    }
    
    if (data.unit_price !== undefined) {
      updateFields.push('unit_price = ?');
      updateValues.push(data.unit_price);
    }
    
    if (data.unit_cost !== undefined) {
      updateFields.push('unit_cost = ?');
      updateValues.push(data.unit_cost);
    }
    
    if (data.affects_production_cost !== undefined) {
      updateFields.push('affects_production_cost = ?');
      updateValues.push(data.affects_production_cost);
    }
    
    if (data.purchase_item_id !== undefined) {
      updateFields.push('purchase_item_id = ?');
      updateValues.push(data.purchase_item_id);
    }
    
    if (data.total_price !== undefined) {
      updateFields.push('total_price = ?');
      updateValues.push(data.total_price);
    } else if (data.quantity !== undefined || data.unit_price !== undefined) {
      // Recalculate total_price if quantity or unit_price changed
      const item = await this.getInvoiceItemById(itemId, connection);
      if (item) {
        const quantity = data.quantity !== undefined ? data.quantity : item.quantity;
        const unitPrice = data.unit_price !== undefined ? data.unit_price : item.unit_price;
        updateFields.push('total_price = ?');
        updateValues.push(quantity * unitPrice);
      }
    }
    
    if (updateFields.length === 0) {
      return await this.getInvoiceItemById(itemId, connection);
    }
    
    updateValues.push(invoiceId, itemId);
    const updateQuery = `UPDATE supplier_invoice_items SET ${updateFields.join(', ')} WHERE invoice_id = ? AND id = ?`;
    
    await executeQuery(updateQuery, updateValues, connection);
    
    // Update invoice totals
    await this.updateInvoiceTotals(invoiceId, connection);
    
    return await this.getInvoiceItemById(itemId, connection);
  }
  
  // Delete invoice item
  async deleteInvoiceItem(invoiceId: number, itemId: number, connection?: PoolConnection): Promise<boolean> {
    const deleteQuery = `DELETE FROM supplier_invoice_items WHERE invoice_id = ? AND id = ?`;
    const result = await executeQuery(deleteQuery, [invoiceId, itemId], connection);
    
    if (!result || !('affectedRows' in result) || result.affectedRows === 0) {
      return false;
    }
    
    // Update invoice totals
    await this.updateInvoiceTotals(invoiceId, connection);
    
    return true;
  }
  
  // Update invoice totals (subtotal, tax_amount, total_amount) from items
  private async updateInvoiceTotals(invoiceId: number, connection?: PoolConnection): Promise<void> {
    const query = `
      SELECT 
        SUM(total_price) as subtotal
      FROM supplier_invoice_items
      WHERE invoice_id = ?
    `;
    
    const [result] = await executeQuery(query, [invoiceId], connection);
    const subtotal = result?.subtotal || 0;
    
    // Calculate tax (assuming 21% IVA if not specified)
    const invoice = await this.getInvoiceById(invoiceId, connection);
    const taxAmount = invoice?.tax_amount || (subtotal * 0.21);
    const totalAmount = subtotal + taxAmount;
    
    await executeQuery(
      `UPDATE supplier_invoices SET subtotal = ?, tax_amount = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [subtotal, taxAmount, totalAmount, invoiceId],
      connection
    );
  }
}

