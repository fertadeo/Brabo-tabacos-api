import { executeQuery, getConnection } from '../config/database';
import {
  AccruedExpense,
  CreateAccruedExpenseData,
  UpdateAccruedExpenseData,
  ExpenseStatus
} from '../entities/AccruedExpense';

export class AccruedExpenseRepository {
  
  // ========== ACCRUED EXPENSE METHODS ==========
  
  // Get all accrued expenses with pagination and filters
  async getAllExpenses(filters: {
    page?: number;
    limit?: number;
    search?: string;
    supplier_id?: number;
    expense_type?: string;
    category?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ expenses: AccruedExpense[]; total: number }> {
    const { page = 1, limit = 10, search, supplier_id, expense_type, category, status, date_from, date_to } = filters;
    const offset = (page - 1) * limit;
    
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(ae.expense_number LIKE ? OR ae.concept LIKE ? OR s.name LIKE ? OR ae.description LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (supplier_id) {
      whereConditions.push('ae.supplier_id = ?');
      queryParams.push(supplier_id);
    }
    
    if (expense_type) {
      whereConditions.push('ae.expense_type = ?');
      queryParams.push(expense_type);
    }
    
    if (category) {
      whereConditions.push('ae.category = ?');
      queryParams.push(category);
    }
    
    if (status) {
      whereConditions.push('ae.status = ?');
      queryParams.push(status);
    }
    
    if (date_from) {
      whereConditions.push('DATE(ae.accrual_date) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(ae.accrual_date) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM accrued_expenses ae
      LEFT JOIN suppliers s ON ae.supplier_id = s.id
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get expenses with related info
    const selectQuery = `
      SELECT 
        ae.id,
        ae.expense_number,
        ae.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        ae.expense_type,
        ae.concept,
        ae.category,
        ae.description,
        ae.amount,
        ae.accrual_date,
        ae.due_date,
        ae.payment_date,
        ae.status,
        ae.has_invoice,
        ae.invoice_id,
        si.invoice_number,
        COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (ae.amount - COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        ae.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        ae.created_at,
        ae.updated_at
      FROM accrued_expenses ae
      LEFT JOIN suppliers s ON ae.supplier_id = s.id
      LEFT JOIN supplier_invoices si ON ae.invoice_id = si.id
      LEFT JOIN users u ON ae.created_by = u.id
      ${whereClause}
      ORDER BY ae.accrual_date DESC, ae.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const expenses = await executeQuery(selectQuery, [...queryParams, limit, offset]);
    
    return { expenses, total };
  }
  
  // Get expense by ID
  async getExpenseById(id: number): Promise<AccruedExpense | null> {
    const query = `
      SELECT 
        ae.id,
        ae.expense_number,
        ae.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        ae.expense_type,
        ae.concept,
        ae.category,
        ae.description,
        ae.amount,
        ae.accrual_date,
        ae.due_date,
        ae.payment_date,
        ae.status,
        ae.has_invoice,
        ae.invoice_id,
        si.invoice_number,
        COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (ae.amount - COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        ae.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        ae.created_at,
        ae.updated_at
      FROM accrued_expenses ae
      LEFT JOIN suppliers s ON ae.supplier_id = s.id
      LEFT JOIN supplier_invoices si ON ae.invoice_id = si.id
      LEFT JOIN users u ON ae.created_by = u.id
      WHERE ae.id = ?
    `;
    
    const [expense] = await executeQuery(query, [id]);
    return expense || null;
  }
  
  // Get expense by expense number
  async getExpenseByNumber(expenseNumber: string): Promise<AccruedExpense | null> {
    const query = `
      SELECT 
        ae.id,
        ae.expense_number,
        ae.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        ae.expense_type,
        ae.concept,
        ae.category,
        ae.description,
        ae.amount,
        ae.accrual_date,
        ae.due_date,
        ae.payment_date,
        ae.status,
        ae.has_invoice,
        ae.invoice_id,
        si.invoice_number,
        COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0) as paid_amount,
        (ae.amount - COALESCE((SELECT SUM(amount) FROM payments WHERE accrued_expense_id = ae.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount,
        ae.created_by,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        ae.created_at,
        ae.updated_at
      FROM accrued_expenses ae
      LEFT JOIN suppliers s ON ae.supplier_id = s.id
      LEFT JOIN supplier_invoices si ON ae.invoice_id = si.id
      LEFT JOIN users u ON ae.created_by = u.id
      WHERE ae.expense_number = ?
    `;
    
    const [expense] = await executeQuery(query, [expenseNumber]);
    return expense || null;
  }
  
  // Create new expense
  async createExpense(data: CreateAccruedExpenseData, userId?: number): Promise<AccruedExpense> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Generate expense number if not provided
      let expenseNumber = data.expense_number;
      if (!expenseNumber) {
        expenseNumber = await this.generateExpenseNumber();
      }
      
      // Check if expense number already exists
      const existingExpense = await this.getExpenseByNumber(expenseNumber);
      if (existingExpense) {
        throw new Error(`Ya existe un egreso devengado con el número ${expenseNumber}`);
      }
      
      // Insert expense
      const insertQuery = `
        INSERT INTO accrued_expenses (
          expense_number, supplier_id, expense_type, concept, category,
          description, amount, accrual_date, due_date, status, has_invoice, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        expenseNumber,
        data.supplier_id || null,
        data.expense_type,
        data.concept,
        data.category || null,
        null, // description - no está en CreateAccruedExpenseData
        data.amount,
        data.accrual_date || new Date().toISOString().split('T')[0],
        data.due_date || null,
        false, // has_invoice por defecto es false
        data.notes || null,
        userId || null
      ]);
      
      const expenseId = result.insertId;
      
      await connection.commit();
      
      const expense = await this.getExpenseById(expenseId);
      if (!expense) {
        throw new Error('Error creating accrued expense');
      }
      
      return expense;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Update expense
  async updateExpense(id: number, data: UpdateAccruedExpenseData): Promise<AccruedExpense | null> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // expense_number no se puede actualizar (es un identificador único)
    
    if (data.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?');
      updateValues.push(data.supplier_id);
    }
    
    if (data.expense_type !== undefined) {
      updateFields.push('expense_type = ?');
      updateValues.push(data.expense_type);
    }
    
    if (data.concept !== undefined) {
      updateFields.push('concept = ?');
      updateValues.push(data.concept);
    }
    
    if (data.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(data.category);
    }
    
    // description no existe en UpdateAccruedExpenseData, usar notes en su lugar
    
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
    
    if (data.invoice_id !== undefined) {
      updateFields.push('invoice_id = ?');
      updateValues.push(data.invoice_id);
      // Actualizar has_invoice automáticamente basado en invoice_id
      updateFields.push('has_invoice = ?');
      updateValues.push(data.invoice_id !== null);
    }
    
    if (data.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(data.notes);
    }
    
    if (updateFields.length === 0) {
      return await this.getExpenseById(id);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const updateQuery = `UPDATE accrued_expenses SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    return await this.getExpenseById(id);
  }
  
  // Delete expense
  async deleteExpense(id: number): Promise<boolean> {
    const expense = await this.getExpenseById(id);
    if (!expense) {
      return false;
    }
    
    // Check if expense has payments
    const paymentsQuery = `SELECT COUNT(*) as count FROM payments WHERE accrued_expense_id = ?`;
    const [paymentsResult] = await executeQuery(paymentsQuery, [id]);
    
    if (paymentsResult?.count > 0) {
      throw new Error('No se puede eliminar un egreso devengado que tiene pagos asociados');
    }
    
    // Check if expense has invoice linked
    if (expense.has_invoice && expense.invoice_id) {
      throw new Error('No se puede eliminar un egreso devengado que tiene una factura asociada');
    }
    
    const deleteQuery = `DELETE FROM accrued_expenses WHERE id = ?`;
    await executeQuery(deleteQuery, [id]);
    
    return true;
  }
  
  // Link invoice to expense
  async linkInvoiceToExpense(expenseId: number, invoiceId: number): Promise<AccruedExpense | null> {
    const updateQuery = `
      UPDATE accrued_expenses 
      SET invoice_id = ?, has_invoice = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    await executeQuery(updateQuery, [invoiceId, expenseId]);
    
    return await this.getExpenseById(expenseId);
  }
  
  // Update expense payment status based on payments
  async updateExpensePaymentStatus(expenseId: number): Promise<void> {
    const expense = await this.getExpenseById(expenseId);
    if (!expense) return;
    
    // Calculate paid amount from payments
    const paidAmountQuery = `
      SELECT COALESCE(SUM(amount), 0) as paid_amount
      FROM payments
      WHERE accrued_expense_id = ? AND type = 'outflow' AND status = 'posted'
    `;
    const [paidResult] = await executeQuery(paidAmountQuery, [expenseId]);
    const paidAmount = paidResult?.paid_amount || 0;
    const totalAmount = expense.amount;
    
    let status: ExpenseStatus;
    
    if (paidAmount >= totalAmount) {
      status = 'paid';
    } else {
      status = 'pending';
    }
    
    await executeQuery(
      `UPDATE accrued_expenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, expenseId]
    );
  }
  
  // Generate expense number
  async generateExpenseNumber(): Promise<string> {
    const query = `
      SELECT expense_number 
      FROM accrued_expenses 
      WHERE expense_number LIKE 'EGR-%' 
      ORDER BY expense_number DESC 
      LIMIT 1
    `;
    
    const [result] = await executeQuery(query);
    let nextNumber = 1;
    
    if (result && result.expense_number) {
      const match = result.expense_number.match(/EGR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const year = new Date().getFullYear();
    return `EGR-${year}${nextNumber.toString().padStart(4, '0')}`;
  }
}

