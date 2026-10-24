import { executeQuery, getConnection } from '../config/database';
import type { PoolConnection } from 'mysql2/promise';
import {
  SupplierAccount,
  SupplierAccountSummary,
  SupplierAccountMovement,
  CreateSupplierAccountMovementData,
  UpdateSupplierAccountMovementData
} from '../entities/SupplierAccount';

export class SupplierAccountRepository {
  
  // ========== ACCOUNT METHODS ==========
  
  // Get or create account for supplier
  async getOrCreateAccount(supplierId: number, connection?: PoolConnection): Promise<SupplierAccount> {
    let account = await this.getAccountBySupplierId(supplierId, connection);
    
    if (!account) {
      // Create account if it doesn't exist
      const insertQuery = `
        INSERT INTO supplier_accounts (supplier_id, commitment_balance, debt_balance, total_balance, credit_limit)
        VALUES (?, 0, 0, 0, 0)
      `;
      
      await executeQuery(insertQuery, [supplierId], connection);
      account = await this.getAccountBySupplierId(supplierId, connection);
    }
    
    if (!account) {
      throw new Error('Error creating supplier account');
    }
    
    return account;
  }
  
  // Get account by supplier ID
  async getAccountBySupplierId(supplierId: number, connection?: PoolConnection): Promise<SupplierAccount | null> {
    const query = `
      SELECT 
        sa.id,
        sa.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        sa.commitment_balance,
        sa.debt_balance,
        sa.total_balance,
        sa.credit_limit,
        sa.created_at,
        sa.updated_at
      FROM supplier_accounts sa
      LEFT JOIN suppliers s ON sa.supplier_id = s.id
      WHERE sa.supplier_id = ?
    `;
    
    const [account] = await executeQuery(query, [supplierId], connection);
    return account || null;
  }
  
  // Get account by ID
  async getAccountById(id: number, connection?: PoolConnection): Promise<SupplierAccount | null> {
    const query = `
      SELECT 
        sa.id,
        sa.supplier_id,
        s.name as supplier_name,
        s.supplier_type,
        sa.commitment_balance,
        sa.debt_balance,
        sa.total_balance,
        sa.credit_limit,
        sa.created_at,
        sa.updated_at
      FROM supplier_accounts sa
      LEFT JOIN suppliers s ON sa.supplier_id = s.id
      WHERE sa.id = ?
    `;
    
    const [account] = await executeQuery(query, [id], connection);
    return account || null;
  }
  
  // Update account balances
  async updateAccountBalances(supplierId: number, connection?: PoolConnection): Promise<SupplierAccount | null> {
    // Calculate commitment_balance (from purchases with debt_type = 'compromiso' and status != 'cancelled')
    const commitmentQuery = `
      SELECT COALESCE(SUM(commitment_amount), 0) as total_commitment
      FROM purchases
      WHERE supplier_id = ? 
        AND debt_type = 'compromiso' 
        AND status != 'cancelled'
        AND (status != 'received' OR confirmed_at IS NULL)
    `;
    const [commitmentResult] = await executeQuery(commitmentQuery, [supplierId], connection);
    const commitmentBalance = commitmentResult?.total_commitment || 0;
    
    // Calculate debt_balance (from invoices with payment_status != 'paid')
    const debtQuery = `
      SELECT COALESCE(SUM(total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0)), 0) as total_debt
      FROM supplier_invoices si
      WHERE si.supplier_id = ?
        AND si.status != 'cancelled'
        AND si.payment_status != 'paid'
    `;
    const [debtResult] = await executeQuery(debtQuery, [supplierId], connection);
    const debtBalance = debtResult?.total_debt || 0;
    
    // Calculate total_balance
    const totalBalance = commitmentBalance + debtBalance;
    
    // Update account
    const updateQuery = `
      UPDATE supplier_accounts 
      SET commitment_balance = ?, 
          debt_balance = ?, 
          total_balance = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE supplier_id = ?
    `;
    
    await executeQuery(updateQuery, [commitmentBalance, debtBalance, totalBalance, supplierId], connection);
    
    return await this.getAccountBySupplierId(supplierId, connection);
  }
  
  // Update credit limit
  async updateCreditLimit(
    supplierId: number,
    creditLimit: number,
    connection?: PoolConnection
  ): Promise<SupplierAccount | null> {
    const updateQuery = `
      UPDATE supplier_accounts 
      SET credit_limit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE supplier_id = ?
    `;
    
    await executeQuery(updateQuery, [creditLimit, supplierId], connection);
    return await this.getAccountBySupplierId(supplierId, connection);
  }
  
  // Get account summary with movements
  async getAccountSummary(supplierId: number, filters: {
    page?: number;
    limit?: number;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<SupplierAccountSummary> {
    const account = await this.getAccountBySupplierId(supplierId);
    if (!account) {
      throw new Error('Cuenta de proveedor no encontrada');
    }
    
    // Get movements
    const movements = await this.getMovements(supplierId, filters);
    
    // Calculate pending and overdue invoices
    const invoicesQuery = `
      SELECT 
        COUNT(*) as pending_count,
        SUM(CASE WHEN payment_status IN ('pending', 'partial') THEN total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0) ELSE 0 END) as pending_amount,
        SUM(CASE WHEN payment_status = 'overdue' THEN total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0) ELSE 0 END) as overdue_amount,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue_count
      FROM supplier_invoices si
      WHERE si.supplier_id = ? 
        AND si.status != 'cancelled' 
        AND si.payment_status IN ('pending', 'partial', 'overdue')
    `;
    const [invoicesResult] = await executeQuery(invoicesQuery, [supplierId]);
    
    // Get next due date and amount
    const nextDueQuery = `
      SELECT due_date, (total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = si.id AND type = 'outflow' AND status = 'posted'), 0)) as remaining_amount
      FROM supplier_invoices si
      WHERE si.supplier_id = ? 
        AND si.status != 'cancelled' 
        AND si.payment_status IN ('pending', 'partial')
        AND si.due_date IS NOT NULL
        AND si.due_date >= CURDATE()
      ORDER BY si.due_date ASC
      LIMIT 1
    `;
    const [nextDue] = await executeQuery(nextDueQuery, [supplierId]);
    
    // Calculate available credit
    const availableCredit = account.credit_limit - account.total_balance;
    
    return {
      ...account,
      is_active: true, // Assuming account is active if it exists
      available_credit: availableCredit,
      movements: movements.movements,
      pending_invoices: invoicesResult?.pending_count || 0,
      pending_invoices_amount: invoicesResult?.pending_amount || 0,
      overdue_invoices: invoicesResult?.overdue_count || 0,
      overdue_amount: invoicesResult?.overdue_amount || 0,
      next_due_date: nextDue?.due_date || undefined,
      next_due_amount: nextDue?.remaining_amount || undefined
    };
  }
  
  // ========== MOVEMENT METHODS ==========
  
  // Get all movements for a supplier account
  async getMovements(supplierId: number, filters: {
    page?: number;
    limit?: number;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ movements: SupplierAccountMovement[]; total: number }> {
    const { page = 1, limit = 50, movement_type, date_from, date_to } = filters;
    const offset = (page - 1) * limit;
    
    const account = await this.getAccountBySupplierId(supplierId);
    if (!account) {
      return { movements: [], total: 0 };
    }
    
    const whereConditions: string[] = ['sam.account_id = ?'];
    const queryParams: any[] = [account.id];
    
    if (movement_type) {
      whereConditions.push('sam.movement_type = ?');
      queryParams.push(movement_type);
    }
    
    if (date_from) {
      whereConditions.push('DATE(sam.created_at) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(sam.created_at) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM supplier_account_movements sam
      ${whereClause}
    `;
    const [countResult] = await executeQuery(countQuery, queryParams);
    const total = countResult?.total || 0;
    
    // Get movements
    const selectQuery = `
      SELECT 
        sam.id,
        sam.account_id,
        sam.movement_type,
        sam.type,
        sam.amount,
        sam.balance_after,
        sam.reference_type,
        sam.reference_id,
        sam.due_date,
        sam.payment_date,
        sam.status,
        sam.description,
        sam.created_at,
        sam.updated_at,
        CASE 
          WHEN sam.reference_type = 'purchase' THEN p.purchase_number
          WHEN sam.reference_type = 'invoice' THEN si.invoice_number
          WHEN sam.reference_type = 'payment' THEN CONCAT('PAGO-', pmt.id)
          ELSE NULL
        END as reference_number
      FROM supplier_account_movements sam
      LEFT JOIN purchases p ON sam.reference_type = 'purchase' AND sam.reference_id = p.id
      LEFT JOIN supplier_invoices si ON sam.reference_type = 'invoice' AND sam.reference_id = si.id
      LEFT JOIN payments pmt ON sam.reference_type = 'payment' AND sam.reference_id = pmt.id
      ${whereClause}
      ORDER BY sam.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const movements = await executeQuery(selectQuery, [...queryParams, limit, offset]);
    
    return { movements, total };
  }
  
  // Get movement by ID
  async getMovementById(movementId: number, connection?: PoolConnection): Promise<SupplierAccountMovement | null> {
    const query = `
      SELECT 
        sam.id,
        sam.account_id,
        sam.movement_type,
        sam.type,
        sam.amount,
        sam.balance_after,
        sam.reference_type,
        sam.reference_id,
        sam.due_date,
        sam.payment_date,
        sam.status,
        sam.description,
        sam.created_at,
        sam.updated_at
      FROM supplier_account_movements sam
      WHERE sam.id = ?
    `;
    
    const [movement] = await executeQuery(query, [movementId], connection);
    return movement || null;
  }
  
  // Create movement
  async createMovement(data: CreateSupplierAccountMovementData): Promise<SupplierAccountMovement> {
    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get or create account
      const account = await this.getOrCreateAccount(data.supplier_id);
      
      // Calculate balance_after
      let balanceAfter = account.total_balance;
      if (data.type === 'debit') {
        balanceAfter += data.amount;
      } else {
        balanceAfter -= data.amount;
      }
      
      // Insert movement
      const insertQuery = `
        INSERT INTO supplier_account_movements (
          account_id, movement_type, type, amount, balance_after,
          reference_type, reference_id, due_date, payment_date, status, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await executeQuery(insertQuery, [
        account.id,
        data.movement_type,
        data.type,
        data.amount,
        balanceAfter,
        data.reference_type || null,
        data.reference_id || null,
        data.due_date || null,
        data.payment_date || null,
        data.status || 'pending',
        data.description || null
      ]);
      
      // Update account balances
      await this.updateAccountBalances(account.supplier_id);
      
      await connection.commit();
      
      const movement = await this.getMovementById(result.insertId);
      if (!movement) {
        throw new Error('Error creando el movimiento');
      }
      
      return movement;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Update movement
  async updateMovement(movementId: number, data: UpdateSupplierAccountMovementData): Promise<SupplierAccountMovement | null> {
    const movement = await this.getMovementById(movementId);
    if (!movement) {
      return null;
    }
    
    // Get account from movement.account_id
    const account = await this.getAccountById(movement.account_id);
    if (!account) {
      throw new Error('Cuenta no encontrada');
    }
    
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(data.status);
    }
    
    if (data.payment_date !== undefined) {
      updateFields.push('payment_date = ?');
      updateValues.push(data.payment_date);
    }
    
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(data.description);
    }
    
    if (updateFields.length === 0) {
      return movement;
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(movementId);
    
    const updateQuery = `UPDATE supplier_account_movements SET ${updateFields.join(', ')} WHERE id = ?`;
    await executeQuery(updateQuery, updateValues);
    
    // Update account balances
    await this.updateAccountBalances(account.supplier_id);
    
    return await this.getMovementById(movementId);
  }
  
  // Delete movement
  async deleteMovement(movementId: number): Promise<boolean> {
    const movement = await this.getMovementById(movementId);
    if (!movement) {
      return false;
    }
    
    // Get account from movement.account_id
    const account = await this.getAccountById(movement.account_id);
    if (!account) {
      return false;
    }
    
    const deleteQuery = `DELETE FROM supplier_account_movements WHERE id = ?`;
    await executeQuery(deleteQuery, [movementId]);
    
    // Update account balances
    await this.updateAccountBalances(account.supplier_id);
    
    return true;
  }
}

