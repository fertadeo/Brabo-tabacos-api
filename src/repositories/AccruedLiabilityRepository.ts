import { executeQuery, getConnection } from '../config/database';
import {
  AccruedLiability,
  CreateAccruedLiabilityData,
  UpdateAccruedLiabilityData,
  AccruedLiabilityPayment
} from '../entities/AccruedLiability';

export class AccruedLiabilityRepository {
  
  // ========== ACCRUED LIABILITY METHODS ==========
  
  // Get all accrued liabilities with pagination and filters
  async getAllLiabilities(filters: {
    page?: number;
    limit?: number;
    search?: string;
    liability_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ liabilities: AccruedLiability[]; total: number }> {
    const { page = 1, limit = 10, search, liability_type, status, date_from, date_to } = filters;
    const offset = (page - 1) * limit;
    
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(al.liability_number LIKE ? OR al.description LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }
    
    if (liability_type) {
      whereConditions.push('al.liability_type = ?');
      queryParams.push(liability_type);
    }
    
    if (status) {
      whereConditions.push('al.status = ?');
      queryParams.push(status);
    }
    
    if (date_from) {
      whereConditions.push('DATE(al.accrual_date) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(al.accrual_date) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM accrued_liabilities al
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get liabilities with payment info
    const selectQuery = `
      SELECT 
        al.id,
        al.liability_number,
        al.liability_type,
        al.description,
        al.amount,
        al.accrual_date,
        al.due_date,
        al.payment_date,
        al.status,
        COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0) as paid_amount,
        (al.amount - COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0)) as remaining_amount,
        al.notes,
        al.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        al.created_at,
        al.updated_at
      FROM accrued_liabilities al
      LEFT JOIN users u ON al.created_by = u.id
      ${whereClause}
      ORDER BY al.accrual_date DESC, al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const liabilities = await executeQuery(selectQuery, [...queryParams, limit, offset]);
    
    return { liabilities, total };
  }
  
  // Get liability by ID
  async getLiabilityById(id: number): Promise<AccruedLiability | null> {
    const query = `
      SELECT 
        al.id,
        al.liability_number,
        al.liability_type,
        al.description,
        al.amount,
        al.accrual_date,
        al.due_date,
        al.payment_date,
        al.status,
        COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0) as paid_amount,
        (al.amount - COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0)) as remaining_amount,
        al.notes,
        al.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        al.created_at,
        al.updated_at
      FROM accrued_liabilities al
      LEFT JOIN users u ON al.created_by = u.id
      WHERE al.id = ?
    `;
    
    const [liability] = await executeQuery(query, [id]);
    return liability || null;
  }
  
  // Get liability by liability number
  async getLiabilityByNumber(liabilityNumber: string): Promise<AccruedLiability | null> {
    const query = `
      SELECT 
        al.id,
        al.liability_number,
        al.liability_type,
        al.description,
        al.amount,
        al.accrual_date,
        al.due_date,
        al.payment_date,
        al.status,
        COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0) as paid_amount,
        (al.amount - COALESCE((SELECT SUM(alp.amount) FROM accrued_liability_payments alp WHERE alp.liability_id = al.id), 0)) as remaining_amount,
        al.notes,
        al.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        al.created_at,
        al.updated_at
      FROM accrued_liabilities al
      LEFT JOIN users u ON al.created_by = u.id
      WHERE al.liability_number = ?
    `;
    
    const [liability] = await executeQuery(query, [liabilityNumber]);
    return liability || null;
  }
  
  // Create new liability
  async createLiability(data: CreateAccruedLiabilityData, userId?: number): Promise<AccruedLiability> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Generate liability number if not provided
      let liabilityNumber = data.liability_number;
      if (!liabilityNumber) {
        liabilityNumber = await this.generateLiabilityNumber();
      }
      
      // Check if liability number already exists
      const existingLiability = await this.getLiabilityByNumber(liabilityNumber);
      if (existingLiability) {
        throw new Error(`Ya existe un pasivo devengado con el número ${liabilityNumber}`);
      }
      
      // Insert liability
      const insertQuery = `
        INSERT INTO accrued_liabilities (
          liability_number, liability_type, description, amount,
          accrual_date, due_date, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        liabilityNumber,
        data.liability_type,
        data.description,
        data.amount,
        data.accrual_date || new Date().toISOString().split('T')[0],
        data.due_date || null,
        data.notes || null,
        userId || null
      ]);
      
      const liabilityId = result.insertId;
      
      await connection.commit();
      
      const liability = await this.getLiabilityById(liabilityId);
      if (!liability) {
        throw new Error('Error creating accrued liability');
      }
      
      return liability;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Update liability
  async updateLiability(id: number, data: UpdateAccruedLiabilityData): Promise<AccruedLiability | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // liability_number no se puede actualizar (es un identificador único)
    
    if (data.liability_type !== undefined) {
      updateFields.push('liability_type = ?');
      updateValues.push(data.liability_type);
    }
    
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(data.description);
    }
    
    if (data.amount !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(data.amount);
    }
    
    if (data.accrual_date !== undefined) {
      updateFields.push('accrual_date = ?');
      updateValues.push(data.accrual_date);
    }
    
    if (data.due_date !== undefined) {
      updateFields.push('due_date = ?');
      updateValues.push(data.due_date);
    }
    
    if (data.payment_date !== undefined) {
      updateFields.push('payment_date = ?');
      updateValues.push(data.payment_date);
    }
    
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(data.status);
    }
    
    if (data.treasury_account_id !== undefined) {
      updateFields.push('treasury_account_id = ?');
      updateValues.push(data.treasury_account_id);
    }
    
    if (data.paid_amount !== undefined) {
      updateFields.push('paid_amount = ?');
      updateValues.push(data.paid_amount);
    }
    
    if (data.remaining_amount !== undefined) {
      updateFields.push('remaining_amount = ?');
      updateValues.push(data.remaining_amount);
    }
    
    if (data.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(data.notes);
    }
    
    if (updateFields.length === 0) {
      return await this.getLiabilityById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE accrued_liabilities SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    // Update payment status
    await this.updateLiabilityPaymentStatus(id);
    
    return await this.getLiabilityById(id);
  }
  
  // Delete liability
  async deleteLiability(id: number): Promise<boolean> {
    const liability = await this.getLiabilityById(id);
    if (!liability) {
      return false;
    }
    
    // Check if liability has payments
    const paymentsQuery = `SELECT COUNT(*) as count FROM accrued_liability_payments WHERE liability_id = ?`;
    const [paymentsResult] = await executeQuery(paymentsQuery, [id]);
    
    if (paymentsResult?.count > 0) {
      throw new Error('No se puede eliminar un pasivo devengado que tiene pagos asociados');
    }
    
    const deleteQuery = `DELETE FROM accrued_liabilities WHERE id = ?`;
    await executeQuery(deleteQuery, [id]);
    
    return true;
  }
  
  // Update liability payment status based on payments
  async updateLiabilityPaymentStatus(liabilityId: number): Promise<void> {
    const liability = await this.getLiabilityById(liabilityId);
    if (!liability) return;
    
    const paidAmount = liability.paid_amount || 0;
    const totalAmount = liability.amount;
    
    let status: string;
    
    if (paidAmount <= 0) {
      status = 'pending';
    } else if (paidAmount >= totalAmount) {
      status = 'paid';
    } else {
      status = 'partial_paid';
    }
    
    // Check if overdue
    if (status === 'pending' && liability.due_date) {
      const dueDate = new Date(liability.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        status = 'overdue';
      }
    }
    
    await executeQuery(
      `UPDATE accrued_liabilities SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, liabilityId]
    );
  }
  
  // Generate liability number
  async generateLiabilityNumber(): Promise<string> {
    const query = `
      SELECT liability_number 
      FROM accrued_liabilities 
      WHERE liability_number LIKE 'PAS-%' 
      ORDER BY liability_number DESC 
      LIMIT 1
    `;
    
    const [result] = await executeQuery(query);
    let nextNumber = 1;
    
    if (result && result.liability_number) {
      const match = result.liability_number.match(/PAS-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const year = new Date().getFullYear();
    return `PAS-${year}${nextNumber.toString().padStart(4, '0')}`;
  }
  
  // ========== PAYMENT METHODS ==========
  
  // Get all payments for a liability
  async getLiabilityPayments(liabilityId: number): Promise<AccruedLiabilityPayment[]> {
    const query = `
      SELECT 
        alp.id,
        alp.liability_id,
        alp.payment_id,
        pmt.payment_number,
        pmt.amount,
        pmt.payment_date,
        pmt.status,
        alp.amount as payment_amount,
        alp.payment_date as linked_payment_date,
        alp.created_at
      FROM accrued_liability_payments alp
      LEFT JOIN payments pmt ON alp.payment_id = pmt.id
      WHERE alp.liability_id = ?
      ORDER BY alp.payment_date DESC, alp.created_at DESC
    `;
    
    return await executeQuery(query, [liabilityId]);
  }
  
  // Link payment to liability
  async linkPaymentToLiability(liabilityId: number, paymentId: number, amount: number): Promise<AccruedLiabilityPayment> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Check if payment already linked
      const existingPaymentQuery = `
        SELECT id FROM accrued_liability_payments 
        WHERE liability_id = ? AND payment_id = ?
      `;
      const [existing] = await executeQuery(existingPaymentQuery, [liabilityId, paymentId]);
      
      if (existing) {
        throw new Error('Este pago ya está vinculado a este pasivo');
      }
      
      // Get liability
      const liability = await this.getLiabilityById(liabilityId);
      if (!liability) {
        throw new Error('Pasivo no encontrado');
      }
      
      // Validate amount doesn't exceed remaining amount
      const remainingAmount = liability.remaining_amount || liability.amount;
      if (amount > remainingAmount) {
        throw new Error(`El monto (${amount}) excede el monto pendiente (${remainingAmount})`);
      }
      
      // Get payment
      const paymentQuery = `SELECT id, amount, payment_date, status FROM payments WHERE id = ?`;
      const [payment] = await executeQuery(paymentQuery, [paymentId]);
      
      if (!payment) {
        throw new Error('Pago no encontrado');
      }
      
      // Insert payment link
      const insertQuery = `
        INSERT INTO accrued_liability_payments (liability_id, payment_id, amount, payment_date)
        VALUES (?, ?, ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        liabilityId,
        paymentId,
        amount,
        payment.payment_date || new Date().toISOString().split('T')[0]
      ]);
      
      // Update liability payment status
      await this.updateLiabilityPaymentStatus(liabilityId);
      
      await connection.commit();
      
      // Get the newly created payment link
      const getPaymentQuery = `
        SELECT 
          alp.id,
          alp.liability_id,
          alp.payment_id,
          pmt.payment_number,
          pmt.amount,
          pmt.payment_date,
          pmt.status,
          alp.amount as payment_amount,
          alp.payment_date as linked_payment_date,
          alp.created_at
        FROM accrued_liability_payments alp
        LEFT JOIN payments pmt ON alp.payment_id = pmt.id
        WHERE alp.id = ?
      `;
      const [liabilityPayment] = await executeQuery(getPaymentQuery, [result.insertId]);
      
      if (!liabilityPayment) {
        throw new Error('Error al crear el vínculo de pago');
      }
      
      return liabilityPayment;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Unlink payment from liability
  async unlinkPaymentFromLiability(liabilityId: number, paymentId: number): Promise<boolean> {
    const deleteQuery = `
      DELETE FROM accrued_liability_payments 
      WHERE liability_id = ? AND payment_id = ?
    `;
    
    await executeQuery(deleteQuery, [liabilityId, paymentId]);
    
    // Update liability payment status
    await this.updateLiabilityPaymentStatus(liabilityId);
    
    return true;
  }
}

