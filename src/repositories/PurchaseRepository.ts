import { executeQuery } from '../config/database';
import { Purchase, CreatePurchaseData, UpdatePurchaseData, PurchaseItem, CreatePurchaseItemData, UpdatePurchaseItemData, Supplier, CreateSupplierData } from '../types';

export class PurchaseRepository {
  
  // ========== PURCHASE METHODS ==========
  
  // Get all purchases with pagination and filters
  async getAllPurchases(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplier_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ purchases: Purchase[]; total: number }> {
    const { page = 1, limit = 10, search, status, supplier_id, date_from, date_to } = filters;
    // Ensure limit and offset are integers
    const limitInt = parseInt(String(limit), 10);
    const pageInt = parseInt(String(page), 10);
    const offset = (pageInt - 1) * limitInt;
    
    // Build WHERE conditions
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(p.purchase_number LIKE ? OR s.name LIKE ? OR p.notes LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (status) {
      whereConditions.push('p.status = ?');
      queryParams.push(status);
    }
    
    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?');
      queryParams.push(supplier_id);
    }
    
    if (date_from) {
      whereConditions.push('DATE(p.purchase_date) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(p.purchase_date) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM purchases p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get purchases with supplier info
    // Usamos interpolación para LIMIT/OFFSET para evitar problemas con algunos motores MySQL
    const selectQuery = `
      SELECT 
        p.id,
        p.purchase_number,
        p.supplier_id,
        s.name as supplier_name,
        p.status,
        p.total_amount,
        p.purchase_date,
        p.received_date,
        p.notes,
        p.created_at,
        p.updated_at,
        EXISTS(
          SELECT 1
          FROM supplier_delivery_notes sdn
          WHERE sdn.purchase_id = p.id
            AND sdn.source_file_path IS NOT NULL
            AND TRIM(sdn.source_file_path) != ''
        ) AS has_source_pdf,
        (
          SELECT sdn.delivery_note_number
          FROM supplier_delivery_notes sdn
          WHERE sdn.purchase_id = p.id
            AND sdn.source_file_path IS NOT NULL
            AND TRIM(sdn.source_file_path) != ''
          ORDER BY sdn.created_at DESC
          LIMIT 1
        ) AS source_delivery_note_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;
    
    // Ejecutamos solo con los parámetros del WHERE
    const purchases = await executeQuery(selectQuery, queryParams);
    
    return { purchases, total };
  }
  
  // Get purchase by ID
  async getPurchaseById(id: number): Promise<Purchase | null> {
    const query = `
      SELECT 
        p.id,
        p.purchase_number,
        p.supplier_id,
        s.name as supplier_name,
        p.status,
        p.total_amount,
        p.purchase_date,
        p.received_date,
        p.notes,
        p.created_at,
        p.updated_at,
        EXISTS(
          SELECT 1
          FROM supplier_delivery_notes sdn
          WHERE sdn.purchase_id = p.id
            AND sdn.source_file_path IS NOT NULL
            AND TRIM(sdn.source_file_path) != ''
        ) AS has_source_pdf,
        (
          SELECT sdn.delivery_note_number
          FROM supplier_delivery_notes sdn
          WHERE sdn.purchase_id = p.id
            AND sdn.source_file_path IS NOT NULL
            AND TRIM(sdn.source_file_path) != ''
          ORDER BY sdn.created_at DESC
          LIMIT 1
        ) AS source_delivery_note_number
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `;
    
    const [purchase] = await executeQuery(query, [id]);
    return purchase || null;
  }
  
  // Create new purchase
  async createPurchase(data: CreatePurchaseData): Promise<Purchase> {
    // Generate purchase number
    const purchaseNumber = await this.generatePurchaseNumber();
    
    const insertQuery = `
      INSERT INTO purchases (purchase_number, supplier_id, status, total_amount, purchase_date, received_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      purchaseNumber,
      data.supplier_id,
      data.status || 'pending',
      data.total_amount || 0,
      data.purchase_date || new Date().toISOString(),
      null, // received_date - no está en CreatePurchaseData, se establece cuando se recibe
      data.notes || null
    ]);
    
    const newPurchase = await this.getPurchaseById(result.insertId);
    if (!newPurchase) {
      throw new Error('Error creating purchase');
    }
    
    return newPurchase;
  }
  
  // Update purchase
  async updatePurchase(id: number, data: UpdatePurchaseData): Promise<Purchase | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?');
      updateValues.push(data.supplier_id);
    }
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(data.status);
    }
    if (data.total_amount !== undefined) {
      updateFields.push('total_amount = ?');
      updateValues.push(data.total_amount);
    }
    if (data.purchase_date !== undefined) {
      updateFields.push('purchase_date = ?');
      updateValues.push(data.purchase_date);
    }
    if (data.received_date !== undefined) {
      updateFields.push('received_date = ?');
      updateValues.push(data.received_date);
    }
    if (data.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(data.notes);
    }
    
    if (updateFields.length === 0) {
      return await this.getPurchaseById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE purchases SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    return await this.getPurchaseById(id);
  }
  
  // Delete purchase
  async deletePurchase(id: number): Promise<boolean> {
    const deleteQuery = 'DELETE FROM purchases WHERE id = ?';
    const result = await executeQuery(deleteQuery, [id]);
    return result.affectedRows > 0;
  }
  
  // Generate purchase number
  private async generatePurchaseNumber(): Promise<string> {
    const query = 'SELECT purchase_number FROM purchases ORDER BY id DESC LIMIT 1';
    const [result] = await executeQuery(query);
    
    let nextNumber = 1;
    if (result && result.purchase_number) {
      const match = result.purchase_number.match(/COMP(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return `COMP${nextNumber.toString().padStart(4, '0')}`;
  }
  
  // ========== PURCHASE ITEMS METHODS ==========
  
  // Get purchase items by purchase ID
  async getPurchaseItems(purchaseId: number): Promise<PurchaseItem[]> {
    const query = `
      SELECT 
        pi.id,
        pi.purchase_id,
        pi.product_id,
        p.name as product_name,
        p.code as product_code,
        pi.quantity,
        pi.unit_price,
        pi.total_price,
        pi.created_at
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
      ORDER BY pi.created_at ASC
    `;
    
    return await executeQuery(query, [purchaseId]);
  }
  
  // Create purchase item
  async createPurchaseItem(purchaseId: number, data: CreatePurchaseItemData): Promise<PurchaseItem> {
    const insertQuery = `
      INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      purchaseId,
      data.product_id,
      data.quantity,
      data.unit_price,
      data.total_price
    ]);
    
    // Get the created item
    const query = `
      SELECT 
        pi.id,
        pi.purchase_id,
        pi.product_id,
        p.name as product_name,
        p.code as product_code,
        pi.quantity,
        pi.unit_price,
        pi.total_price,
        pi.created_at
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.id = ?
    `;
    
    const [item] = await executeQuery(query, [result.insertId]);
    return item;
  }
  
  // Update purchase item
  async updatePurchaseItem(purchaseId: number, itemId: number, data: UpdatePurchaseItemData): Promise<PurchaseItem | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.product_id !== undefined) {
      updateFields.push('product_id = ?');
      updateValues.push(data.product_id);
    }
    if (data.quantity !== undefined) {
      updateFields.push('quantity = ?');
      updateValues.push(data.quantity);
    }
    if (data.unit_price !== undefined) {
      updateFields.push('unit_price = ?');
      updateValues.push(data.unit_price);
    }
    if (data.total_price !== undefined) {
      updateFields.push('total_price = ?');
      updateValues.push(data.total_price);
    }
    
    if (updateFields.length === 0) {
      return await this.getPurchaseItemById(itemId);
    }
    
    updateValues.push(purchaseId, itemId);
    const updateQuery = `UPDATE purchase_items SET ${updateFields.join(', ')} WHERE purchase_id = ? AND id = ?`;
    
    await executeQuery(updateQuery, updateValues);
    return await this.getPurchaseItemById(itemId);
  }
  
  // Delete purchase item
  async deletePurchaseItem(purchaseId: number, itemId: number): Promise<boolean> {
    const deleteQuery = 'DELETE FROM purchase_items WHERE purchase_id = ? AND id = ?';
    const result = await executeQuery(deleteQuery, [purchaseId, itemId]);
    return result.affectedRows > 0;
  }
  
  // Get purchase item by ID
  private async getPurchaseItemById(itemId: number): Promise<PurchaseItem | null> {
    const query = `
      SELECT 
        pi.id,
        pi.purchase_id,
        pi.product_id,
        p.name as product_name,
        p.code as product_code,
        pi.quantity,
        pi.unit_price,
        pi.total_price,
        pi.created_at
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.id = ?
    `;
    
    const [item] = await executeQuery(query, [itemId]);
    return item || null;
  }
  
  // ========== SUPPLIER METHODS ==========
  
  // Get all suppliers
  async getAllSuppliers(filters: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    is_active?: boolean;
  } = {}): Promise<{ suppliers: Supplier[]; total: number }> {
    const { page = 1, limit = 10, search, city, is_active } = filters;
    // Ensure limit and offset are integers
    const limitInt = parseInt(String(limit), 10);
    const pageInt = parseInt(String(page), 10);
    const offset = (pageInt - 1) * limitInt;
    
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      // Search across multiple columns including new fields
      // Using COALESCE to handle NULL values safely
      whereConditions.push(`(
        name LIKE ? OR 
        code LIKE ? OR 
        COALESCE(contact_name, '') LIKE ? OR
        COALESCE(legal_name, '') LIKE ? OR
        COALESCE(trade_name, '') LIKE ? OR
        COALESCE(tax_id, '') LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (city) {
      whereConditions.push('city = ?');
      queryParams.push(city);
    }
    
    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      queryParams.push(is_active);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM suppliers ${whereClause}`;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get suppliers - select all columns including new fields
    // Using interpolation for LIMIT/OFFSET instead of parameters to avoid MySQL issues
    const selectQuery = `
      SELECT 
        id, code, supplier_type, name, legal_name, trade_name, purchase_frequency,
        id_type, tax_id, gross_income, vat_condition, account_description,
        product_service, integral_summary_account, cost,
        contact_name, email, phone, address, city, country,
        has_account, payment_terms, is_active,
        created_at, updated_at
      FROM suppliers 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;
    
    // Execute query with only WHERE clause parameters (no LIMIT/OFFSET params)
    const suppliers = await executeQuery(selectQuery, queryParams);
    
    return { suppliers, total };
  }
  
  // Get supplier by ID
  async getSupplierById(id: number): Promise<Supplier | null> {
    const query = `
      SELECT 
        id, code, supplier_type, name, legal_name, trade_name, purchase_frequency,
        id_type, tax_id, gross_income, vat_condition, account_description,
        product_service, integral_summary_account, cost,
        contact_name, email, phone, address, city, country,
        has_account, payment_terms, is_active,
        created_at, updated_at
      FROM suppliers 
      WHERE id = ?
    `;
    const [supplier] = await executeQuery(query, [id]);
    return supplier || null;
  }

  // Get supplier by code (exact match)
  async getSupplierByCode(code: string): Promise<Supplier | null> {
    const query = `
      SELECT 
        id, code, supplier_type, name, legal_name, trade_name, purchase_frequency,
        id_type, tax_id, gross_income, vat_condition, account_description,
        product_service, integral_summary_account, cost,
        contact_name, email, phone, address, city, country,
        has_account, payment_terms, is_active,
        created_at, updated_at
      FROM suppliers 
      WHERE code = ?
    `;
    const [supplier] = await executeQuery(query, [code]);
    return supplier || null;
  }
  
  // Create supplier
  async createSupplier(data: CreateSupplierData): Promise<Supplier> {
    const insertQuery = `
      INSERT INTO suppliers (
        code, name, supplier_type, legal_name, trade_name, purchase_frequency,
        id_type, tax_id, gross_income, vat_condition, account_description,
        product_service, integral_summary_account, cost,
        contact_name, email, phone, address, city, country,
        has_account, payment_terms, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;
    
    const result = await executeQuery(insertQuery, [
      data.code,
      data.name,
      data.supplier_type || 'no_productivo',
      data.legal_name || null,
      data.trade_name || null,
      data.purchase_frequency || null,
      data.id_type || null,
      data.tax_id || null,
      data.gross_income || null,
      data.vat_condition || null,
      data.account_description || null,
      data.product_service || null,
      data.integral_summary_account || null,
      data.cost || null,
      data.contact_name || null,
      data.email || null,
      data.phone || null,
      data.address || null,
      data.city || null,
      data.country || 'Argentina',
      data.has_account !== undefined ? (
        (typeof data.has_account === 'boolean' && data.has_account) ||
        (typeof data.has_account === 'number' && data.has_account === 1) ||
        (typeof data.has_account === 'string' && (data.has_account === '1' || data.has_account === 'true'))
          ? 1 : 0
      ) : 1,
      data.payment_terms || 30
    ]);
    
    const newSupplier = await this.getSupplierById(result.insertId);
    if (!newSupplier) {
      throw new Error('Error creating supplier');
    }
    
    return newSupplier;
  }
  
  // Update supplier
  async updateSupplier(id: number, data: Partial<CreateSupplierData & { is_active?: boolean }>): Promise<Supplier | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        // Normalizar valores booleanos para la base de datos
        let dbValue = value;
        if (key === 'has_account' || key === 'is_active') {
          if (typeof value === 'boolean') {
            dbValue = value ? 1 : 0;
          } else if (typeof value === 'number') {
            dbValue = value === 1 ? 1 : 0;
          }
        }
        updateFields.push(`${key} = ?`);
        updateValues.push(dbValue);
      }
    });
    
    if (updateFields.length === 0) {
      return await this.getSupplierById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE suppliers SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    return await this.getSupplierById(id);
  }
  
  // Delete supplier
  async deleteSupplier(id: number): Promise<boolean> {
    // Check if supplier has any related records in any table
    const checks = await Promise.all([
      executeQuery('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [id]),
      executeQuery('SELECT COUNT(*) as count FROM supplier_invoices WHERE supplier_id = ?', [id]),
      executeQuery('SELECT COUNT(*) as count FROM supplier_delivery_notes WHERE supplier_id = ?', [id]),
      executeQuery('SELECT COUNT(*) as count FROM supplier_accounts WHERE supplier_id = ?', [id]),
      executeQuery('SELECT COUNT(*) as count FROM accrued_expenses WHERE supplier_id = ?', [id])
    ]);
    
    // Check if any table has records
    const hasRelatedRecords = checks.some(result => {
      const [row] = result;
      return row?.count > 0;
    });
    
    if (hasRelatedRecords) {
      // Soft delete - deactivate supplier (cannot delete due to foreign key constraints)
      await executeQuery('UPDATE suppliers SET is_active = 0 WHERE id = ?', [id]);
      return true;
    } else {
      // Hard delete - remove supplier completely (only if no related records exist)
      const deleteQuery = 'DELETE FROM suppliers WHERE id = ?';
      const result = await executeQuery(deleteQuery, [id]);
      return result.affectedRows > 0;
    }
  }
}
