import { executeQuery, getConnection } from '../config/database';
import type { PoolConnection } from 'mysql2/promise';
import {
  SupplierDeliveryNote,
  CreateSupplierDeliveryNoteData,
  UpdateSupplierDeliveryNoteData,
  SupplierDeliveryNoteItem,
  CreateSupplierDeliveryNoteItemData,
  UpdateSupplierDeliveryNoteItemData
} from '../entities/SupplierDeliveryNote';

export class SupplierDeliveryNoteRepository {
  
  // ========== DELIVERY NOTE METHODS ==========
  
  // Get all delivery notes with pagination and filters
  async getAllDeliveryNotes(filters: {
    page?: number;
    limit?: number;
    search?: string;
    supplier_id?: number;
    purchase_id?: number;
    invoice_id?: number;
    status?: string;
  } = {}): Promise<{ delivery_notes: SupplierDeliveryNote[]; total: number }> {
    const { page = 1, limit = 10, search, supplier_id, purchase_id, invoice_id, status } = filters;
    const offset = (page - 1) * limit;
    
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(sdn.delivery_note_number LIKE ? OR s.name LIKE ? OR sdn.notes LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (supplier_id) {
      whereConditions.push('sdn.supplier_id = ?');
      queryParams.push(supplier_id);
    }
    
    if (purchase_id) {
      whereConditions.push('sdn.purchase_id = ?');
      queryParams.push(purchase_id);
    }
    
    if (invoice_id) {
      whereConditions.push('sdn.invoice_id = ?');
      queryParams.push(invoice_id);
    }
    
    if (status) {
      whereConditions.push('sdn.status = ?');
      queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM supplier_delivery_notes sdn
      LEFT JOIN suppliers s ON sdn.supplier_id = s.id
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get delivery notes with related info
    const selectQuery = `
      SELECT 
        sdn.id,
        sdn.delivery_note_number,
        sdn.supplier_id,
        s.name as supplier_name,
        sdn.purchase_id,
        p.purchase_number,
        sdn.invoice_id,
        si.invoice_number,
        sdn.delivery_date,
        sdn.received_date,
        sdn.status,
        sdn.matches_invoice,
        sdn.notes,
        sdn.received_by,
        u.first_name as received_by_name,
        sdn.created_at,
        sdn.updated_at,
        (SELECT COUNT(*) FROM supplier_delivery_note_items WHERE delivery_note_id = sdn.id) as items_count
      FROM supplier_delivery_notes sdn
      LEFT JOIN suppliers s ON sdn.supplier_id = s.id
      LEFT JOIN purchases p ON sdn.purchase_id = p.id
      LEFT JOIN supplier_invoices si ON sdn.invoice_id = si.id
      LEFT JOIN users u ON sdn.received_by = u.id
      ${whereClause}
      ORDER BY sdn.delivery_date DESC, sdn.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const delivery_notes = await executeQuery(selectQuery, [...queryParams, limit, offset]);
    
    return { delivery_notes, total };
  }
  
  // Get delivery note by ID
  async getDeliveryNoteById(id: number, connection?: PoolConnection): Promise<SupplierDeliveryNote | null> {
    const query = `
      SELECT 
        sdn.id,
        sdn.delivery_note_number,
        sdn.supplier_id,
        s.name as supplier_name,
        sdn.purchase_id,
        p.purchase_number,
        sdn.invoice_id,
        si.invoice_number,
        sdn.delivery_date,
        sdn.received_date,
        sdn.status,
        sdn.matches_invoice,
        sdn.notes,
        sdn.received_by,
        CONCAT(u.first_name, ' ', u.last_name) as received_by_name,
        sdn.created_at,
        sdn.updated_at
      FROM supplier_delivery_notes sdn
      LEFT JOIN suppliers s ON sdn.supplier_id = s.id
      LEFT JOIN purchases p ON sdn.purchase_id = p.id
      LEFT JOIN supplier_invoices si ON sdn.invoice_id = si.id
      LEFT JOIN users u ON sdn.received_by = u.id
      WHERE sdn.id = ?
    `;
    
    const [deliveryNote] = await executeQuery(query, [id], connection);
    return deliveryNote || null;
  }
  
  // Get delivery note by number
  async getDeliveryNoteByNumber(
    deliveryNoteNumber: string,
    connection?: PoolConnection
  ): Promise<SupplierDeliveryNote | null> {
    const query = `
      SELECT 
        sdn.id,
        sdn.delivery_note_number,
        sdn.supplier_id,
        s.name as supplier_name,
        sdn.purchase_id,
        p.purchase_number,
        sdn.invoice_id,
        si.invoice_number,
        sdn.delivery_date,
        sdn.received_date,
        sdn.status,
        sdn.matches_invoice,
        sdn.notes,
        sdn.received_by,
        CONCAT(u.first_name, ' ', u.last_name) as received_by_name,
        sdn.created_at,
        sdn.updated_at
      FROM supplier_delivery_notes sdn
      LEFT JOIN suppliers s ON sdn.supplier_id = s.id
      LEFT JOIN purchases p ON sdn.purchase_id = p.id
      LEFT JOIN supplier_invoices si ON sdn.invoice_id = si.id
      LEFT JOIN users u ON sdn.received_by = u.id
      WHERE sdn.delivery_note_number = ?
    `;
    
    const [deliveryNote] = await executeQuery(query, [deliveryNoteNumber], connection);
    return deliveryNote || null;
  }
  
  // Create new delivery note
  async createDeliveryNote(data: CreateSupplierDeliveryNoteData, userId?: number): Promise<SupplierDeliveryNote> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if delivery note number already exists
      const existingDeliveryNote = await this.getDeliveryNoteByNumber(data.delivery_note_number, connection);
      if (existingDeliveryNote) {
        throw new Error(`Ya existe un remito con el número ${data.delivery_note_number}`);
      }
      
      // Insert delivery note
      const insertQuery = `
        INSERT INTO supplier_delivery_notes (
          delivery_note_number, supplier_id, purchase_id, invoice_id,
          delivery_date, notes, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        data.delivery_note_number,
        data.supplier_id,
        data.purchase_id,
        data.invoice_id || null,
        data.delivery_date,
        data.notes || null,
        userId || null
      ], connection);
      
      const deliveryNoteId = result.insertId;
      
      // Insert delivery note items
      for (const item of data.items) {
        await this.createDeliveryNoteItem(deliveryNoteId, item, connection);
      }
      
      // Update delivery note status based on purchase items
      await this.updateDeliveryNoteStatus(deliveryNoteId, connection);
      
      await connection.commit();
      
      const deliveryNote = await this.getDeliveryNoteById(deliveryNoteId);
      if (!deliveryNote) {
        throw new Error('Error creating delivery note');
      }
      
      return deliveryNote;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Update delivery note
  async updateDeliveryNote(id: number, data: UpdateSupplierDeliveryNoteData): Promise<SupplierDeliveryNote | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.delivery_note_number !== undefined) {
      // Check if new delivery note number already exists (excluding current delivery note)
      const existingDeliveryNote = await this.getDeliveryNoteByNumber(data.delivery_note_number);
      if (existingDeliveryNote && existingDeliveryNote.id !== id) {
        throw new Error(`Ya existe un remito con el número ${data.delivery_note_number}`);
      }
      updateFields.push('delivery_note_number = ?');
      updateValues.push(data.delivery_note_number);
    }
    
    if (data.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?');
      updateValues.push(data.supplier_id);
    }
    
    if (data.purchase_id !== undefined) {
      updateFields.push('purchase_id = ?');
      updateValues.push(data.purchase_id);
    }
    
    if (data.invoice_id !== undefined) {
      updateFields.push('invoice_id = ?');
      updateValues.push(data.invoice_id);
      
      // Update matches_invoice flag
      if (data.invoice_id) {
        updateFields.push('matches_invoice = TRUE');
      }
    }
    
    if (data.delivery_date !== undefined) {
      updateFields.push('delivery_date = ?');
      updateValues.push(data.delivery_date);
    }
    
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(data.status);
    }
    
    if (data.matches_invoice !== undefined) {
      updateFields.push('matches_invoice = ?');
      updateValues.push(data.matches_invoice);
    }
    
    if (data.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(data.notes);
    }
    
    if (updateFields.length === 0) {
      return await this.getDeliveryNoteById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE supplier_delivery_notes SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    // Update status if needed
    if (data.purchase_id !== undefined) {
      await this.updateDeliveryNoteStatus(id);
    }
    
    return await this.getDeliveryNoteById(id);
  }
  
  // Delete delivery note
  async deleteDeliveryNote(id: number): Promise<boolean> {
    const deliveryNote = await this.getDeliveryNoteById(id);
    if (!deliveryNote) {
      return false;
    }
    
    const deleteQuery = `DELETE FROM supplier_delivery_notes WHERE id = ?`;
    await executeQuery(deleteQuery, [id]);
    
    return true;
  }
  
  // Link invoice to delivery note
  async linkInvoice(deliveryNoteId: number, invoiceId: number): Promise<SupplierDeliveryNote | null> {
    const updateQuery = `UPDATE supplier_delivery_notes SET invoice_id = ?, matches_invoice = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await executeQuery(updateQuery, [invoiceId, deliveryNoteId]);
    
    // Also update invoice to link delivery note
    await executeQuery(
      `UPDATE supplier_invoices SET delivery_note_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [deliveryNoteId, invoiceId]
    );
    
    return await this.getDeliveryNoteById(deliveryNoteId);
  }
  
  // Update delivery note status based on purchase items
  private async updateDeliveryNoteStatus(deliveryNoteId: number, connection?: PoolConnection): Promise<void> {
    const deliveryNote = await this.getDeliveryNoteById(deliveryNoteId, connection);
    if (!deliveryNote) return;
    
    if (!deliveryNote.purchase_id) {
      await executeQuery(
        `UPDATE supplier_delivery_notes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ['pending', deliveryNoteId],
        connection
      );
      return;
    }
    
    // Get purchase items to compare
    const purchaseItemsQuery = `
      SELECT 
        pi.id,
        pi.quantity,
        COALESCE(SUM(dni.quantity), 0) as received_quantity
      FROM purchase_items pi
      LEFT JOIN supplier_delivery_note_items dni ON dni.purchase_item_id = pi.id
      WHERE pi.purchase_id = ?
      GROUP BY pi.id, pi.quantity
    `;
    
    const purchaseItems = await executeQuery(purchaseItemsQuery, [deliveryNote.purchase_id], connection);
    
    let allComplete = true;
    let hasPartial = false;
    
    for (const pi of purchaseItems) {
      if (pi.received_quantity < pi.quantity) {
        allComplete = false;
        if (pi.received_quantity > 0) {
          hasPartial = true;
        }
      }
    }
    
    let status: string;
    if (purchaseItems.length === 0) {
      status = 'pending';
    } else if (allComplete) {
      status = 'complete';
    } else if (hasPartial) {
      status = 'partial';
    } else {
      status = 'pending';
    }
    
    await executeQuery(
      `UPDATE supplier_delivery_notes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, deliveryNoteId],
      connection
    );
    
    await executeQuery(
      `UPDATE purchase_items pi
       SET received_quantity = (
         SELECT COALESCE(SUM(dni.quantity), 0)
         FROM supplier_delivery_note_items dni
         WHERE dni.purchase_item_id = pi.id
       )
       WHERE pi.purchase_id = ?`,
      [deliveryNote.purchase_id],
      connection
    );
  }
  
  // ========== DELIVERY NOTE ITEMS METHODS ==========
  
  // Get delivery note items by delivery note ID
  async getDeliveryNoteItems(deliveryNoteId: number, connection?: PoolConnection): Promise<SupplierDeliveryNoteItem[]> {
    const query = `
      SELECT 
        sdni.id,
        sdni.delivery_note_id,
        sdni.material_code,
        sdni.product_id,
        p.name as product_name,
        p.code as product_code,
        sdni.quantity,
        sdni.purchase_item_id,
        sdni.invoice_item_id,
        sdni.quality_check,
        sdni.quality_notes,
        sdni.created_at
      FROM supplier_delivery_note_items sdni
      LEFT JOIN products p ON sdni.product_id = p.id
      WHERE sdni.delivery_note_id = ?
      ORDER BY sdni.created_at ASC
    `;
    
    return await executeQuery(query, [deliveryNoteId], connection);
  }
  
  // Get delivery note item by ID
  async getDeliveryNoteItemById(itemId: number, connection?: PoolConnection): Promise<SupplierDeliveryNoteItem | null> {
    const query = `
      SELECT 
        sdni.id,
        sdni.delivery_note_id,
        sdni.material_code,
        sdni.product_id,
        p.name as product_name,
        p.code as product_code,
        sdni.quantity,
        sdni.purchase_item_id,
        sdni.invoice_item_id,
        sdni.quality_check,
        sdni.quality_notes,
        sdni.created_at
      FROM supplier_delivery_note_items sdni
      LEFT JOIN products p ON sdni.product_id = p.id
      WHERE sdni.id = ?
    `;
    
    const [item] = await executeQuery(query, [itemId], connection);
    return item || null;
  }
  
  // Create delivery note item
  async createDeliveryNoteItem(
    deliveryNoteId: number,
    data: CreateSupplierDeliveryNoteItemData,
    connection?: PoolConnection
  ): Promise<SupplierDeliveryNoteItem> {
    // Validate quantity doesn't exceed pending quantity in purchase
    if (data.purchase_item_id) {
      const purchaseItemQuery = `
        SELECT 
          pi.quantity,
          pi.received_quantity,
          (pi.quantity - pi.received_quantity) as pending_quantity
        FROM purchase_items pi
        WHERE pi.id = ?
      `;
      const [purchaseItem] = await executeQuery(purchaseItemQuery, [data.purchase_item_id], connection);
      
      if (purchaseItem && data.quantity > purchaseItem.pending_quantity) {
        throw new Error(`La cantidad (${data.quantity}) excede la cantidad pendiente (${purchaseItem.pending_quantity})`);
      }
    }
    
    const insertQuery = `
      INSERT INTO supplier_delivery_note_items (
        delivery_note_id, material_code, product_id, quantity,
        purchase_item_id, invoice_item_id, quality_check, quality_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeQuery(insertQuery, [
      deliveryNoteId,
      data.material_code,
      data.product_id || null,
      data.quantity,
      data.purchase_item_id || null,
      data.invoice_item_id || null,
      data.quality_check || false,
      data.quality_notes || null
    ], connection);
    
    const item = await this.getDeliveryNoteItemById(result.insertId, connection);
    if (!item) {
      throw new Error('Error creando el item de remito');
    }
    
    return item;
  }
  
  // Update delivery note item
  async updateDeliveryNoteItem(
    deliveryNoteId: number,
    itemId: number,
    data: UpdateSupplierDeliveryNoteItemData,
    connection?: PoolConnection
  ): Promise<SupplierDeliveryNoteItem | null> {
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
    
    if (data.quantity !== undefined) {
      // Validate quantity
      const item = await this.getDeliveryNoteItemById(itemId, connection);
      if (item && item.purchase_item_id) {
        const purchaseItemQuery = `
          SELECT 
            pi.quantity,
            pi.received_quantity,
            (pi.quantity - pi.received_quantity) as pending_quantity
          FROM purchase_items pi
          WHERE pi.id = ?
        `;
        const [purchaseItem] = await executeQuery(purchaseItemQuery, [item.purchase_item_id], connection);
        
        if (purchaseItem) {
          const currentReceived = item.quantity;
          const newReceived = data.quantity;
          const diff = newReceived - currentReceived;
          
          if (diff > purchaseItem.pending_quantity) {
            throw new Error(`La cantidad excede la cantidad pendiente (${purchaseItem.pending_quantity})`);
          }
        }
      }
      
      updateFields.push('quantity = ?');
      updateValues.push(data.quantity);
    }
    
    if (data.purchase_item_id !== undefined) {
      updateFields.push('purchase_item_id = ?');
      updateValues.push(data.purchase_item_id);
    }
    
    if (data.invoice_item_id !== undefined) {
      updateFields.push('invoice_item_id = ?');
      updateValues.push(data.invoice_item_id);
    }
    
    if (data.quality_check !== undefined) {
      updateFields.push('quality_check = ?');
      updateValues.push(data.quality_check);
    }
    
    if (data.quality_notes !== undefined) {
      updateFields.push('quality_notes = ?');
      updateValues.push(data.quality_notes);
    }
    
    if (updateFields.length === 0) {
      return await this.getDeliveryNoteItemById(itemId, connection);
    }
    
    updateValues.push(deliveryNoteId, itemId);
    const updateQuery = `UPDATE supplier_delivery_note_items SET ${updateFields.join(', ')} WHERE delivery_note_id = ? AND id = ?`;
    
    await executeQuery(updateQuery, updateValues, connection);
    
    // Update delivery note status
    await this.updateDeliveryNoteStatus(deliveryNoteId, connection);
    
    const item = await this.getDeliveryNoteItemById(itemId, connection);
    if (!item) {
      throw new Error('Error actualizando el item de remito');
    }
    
    return item;
  }
  
  // Delete delivery note item
  async deleteDeliveryNoteItem(deliveryNoteId: number, itemId: number, connection?: PoolConnection): Promise<boolean> {
    const item = await this.getDeliveryNoteItemById(itemId, connection);
    if (!item) {
      return false;
    }
    
    const deleteQuery = `DELETE FROM supplier_delivery_note_items WHERE delivery_note_id = ? AND id = ?`;
    const result = await executeQuery(deleteQuery, [deliveryNoteId, itemId], connection);
    
    if (!result || !('affectedRows' in result) || result.affectedRows === 0) {
      return false;
    }
    
    // Update delivery note status
    await this.updateDeliveryNoteStatus(deliveryNoteId, connection);
    
    return true;
  }
  
  // Generate delivery note number
  async generateDeliveryNoteNumber(): Promise<string> {
    const query = `
      SELECT delivery_note_number 
      FROM supplier_delivery_notes 
      WHERE delivery_note_number LIKE 'RE-%' 
      ORDER BY delivery_note_number DESC 
      LIMIT 1
    `;
    
    const [result] = await executeQuery(query);
    let nextNumber = 1;
    
    if (result && result.delivery_note_number) {
      const match = result.delivery_note_number.match(/RE-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const year = new Date().getFullYear();
    return `RE-${year}${nextNumber.toString().padStart(4, '0')}`;
  }
}

