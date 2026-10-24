import { AccruedExpenseRepository } from '../repositories/AccruedExpenseRepository';
import { SupplierInvoiceRepository } from '../repositories/SupplierInvoiceRepository';
import { executeQuery } from '../config/database';
import {
  AccruedExpense,
  CreateAccruedExpenseData,
  UpdateAccruedExpenseData
} from '../entities/AccruedExpense';

export class AccruedExpenseService {
  private expenseRepository: AccruedExpenseRepository;
  private invoiceRepository: SupplierInvoiceRepository;

  constructor() {
    this.expenseRepository = new AccruedExpenseRepository();
    this.invoiceRepository = new SupplierInvoiceRepository();
  }

  // ========== EXPENSE METHODS ==========

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
  } = {}) {
    return await this.expenseRepository.getAllExpenses(filters);
  }

  async getExpenseById(id: number): Promise<AccruedExpense | null> {
    return await this.expenseRepository.getExpenseById(id);
  }

  async createExpense(data: CreateAccruedExpenseData, userId?: number): Promise<AccruedExpense> {
    // Validate supplier exists (if provided)
    if (data.supplier_id) {
      const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
      const [supplier] = await executeQuery(supplierQuery, [data.supplier_id]);

      if (!supplier) {
        throw new Error('Proveedor no encontrado');
      }
    }

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Validate accrual_date is not in the future
    const accrualDate = new Date(data.accrual_date || new Date().toISOString().split('T')[0]);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (accrualDate > today) {
      throw new Error('La fecha de devengamiento no puede ser futura');
    }

    // Validate due_date is after accrual_date if provided
    if (data.due_date) {
      const dueDate = new Date(data.due_date);
      if (dueDate < accrualDate) {
        throw new Error('La fecha de vencimiento debe ser posterior a la fecha de devengamiento');
      }
    }

    return await this.expenseRepository.createExpense(data, userId);
  }

  async updateExpense(id: number, data: UpdateAccruedExpenseData): Promise<AccruedExpense | null> {
    const existingExpense = await this.expenseRepository.getExpenseById(id);
    if (!existingExpense) {
      throw new Error('Egreso devengado no encontrado');
    }

    // Validate supplier exists if supplier_id is being changed
    if (data.supplier_id !== undefined && data.supplier_id !== existingExpense.supplier_id) {
      if (data.supplier_id) {
        const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
        const [supplier] = await executeQuery(supplierQuery, [data.supplier_id]);

        if (!supplier) {
          throw new Error('Proveedor no encontrado');
        }
      }
    }

    // Validate amount is positive if being changed
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Validate dates if being changed
    const accrualDate = data.accrual_date 
      ? new Date(data.accrual_date) 
      : new Date(existingExpense.accrual_date);
    const dueDate = data.due_date 
      ? new Date(data.due_date) 
      : existingExpense.due_date ? new Date(existingExpense.due_date) : null;

    if (dueDate && dueDate < accrualDate) {
      throw new Error('La fecha de vencimiento debe ser posterior a la fecha de devengamiento');
    }

    // Check if expense has payments and trying to change amount
    if (data.amount !== undefined && existingExpense.paid_amount > 0) {
      if (data.amount < existingExpense.paid_amount) {
        throw new Error(`No se puede reducir el monto por debajo del monto pagado (${existingExpense.paid_amount})`);
      }
    }

    return await this.expenseRepository.updateExpense(id, data);
  }

  async deleteExpense(id: number): Promise<boolean> {
    const expense = await this.expenseRepository.getExpenseById(id);
    if (!expense) {
      throw new Error('Egreso devengado no encontrado');
    }

    // Check if expense has payments
    if (expense.paid_amount > 0) {
      throw new Error('No se puede eliminar un egreso devengado que tiene pagos asociados');
    }

    // Check if expense has invoice linked
    if (expense.has_invoice && expense.invoice_id) {
      throw new Error('No se puede eliminar un egreso devengado que tiene una factura asociada');
    }

    return await this.expenseRepository.deleteExpense(id);
  }

  async linkInvoiceToExpense(expenseId: number, invoiceId: number): Promise<AccruedExpense | null> {
    const expense = await this.expenseRepository.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Egreso devengado no encontrado');
    }

    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Validate supplier matches (if expense has supplier)
    if (expense.supplier_id && invoice.supplier_id !== expense.supplier_id) {
      throw new Error('El proveedor del egreso devengado no coincide con el proveedor de la factura');
    }

    // Validate amounts match (approximately)
    const amountDifference = Math.abs(invoice.total_amount - expense.amount);
    const tolerance = 0.01; // Allow small differences due to rounding

    if (amountDifference > tolerance) {
      throw new Error(
        `El monto de la factura (${invoice.total_amount}) no coincide con el monto del egreso devengado (${expense.amount})`
      );
    }

    // Link invoice
    return await this.expenseRepository.linkInvoiceToExpense(expenseId, invoiceId);
  }

  async updateExpensePaymentStatus(expenseId: number): Promise<void> {
    const expense = await this.expenseRepository.getExpenseById(expenseId);
    if (!expense) {
      throw new Error('Egreso devengado no encontrado');
    }

    await this.expenseRepository.updateExpensePaymentStatus(expenseId);
  }
}

