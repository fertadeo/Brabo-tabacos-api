import { SupplierAccountRepository } from '../repositories/SupplierAccountRepository';
import { executeQuery } from '../config/database';
import {
  SupplierAccount,
  SupplierAccountSummary,
  SupplierAccountMovement,
  CreateSupplierAccountMovementData
} from '../entities/SupplierAccount';

export class SupplierAccountService {
  private accountRepository: SupplierAccountRepository;

  constructor() {
    this.accountRepository = new SupplierAccountRepository();
  }

  // ========== ACCOUNT METHODS ==========

  async getAccountBySupplierId(supplierId: number): Promise<SupplierAccount | null> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [supplierId]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Get or create account
    return await this.accountRepository.getOrCreateAccount(supplierId);
  }

  async getAccountSummary(supplierId: number, filters: {
    page?: number;
    limit?: number;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<SupplierAccountSummary> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [supplierId]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Update account balances before returning summary
    await this.accountRepository.updateAccountBalances(supplierId);

    return await this.accountRepository.getAccountSummary(supplierId, filters);
  }

  async updateCreditLimit(supplierId: number, creditLimit: number): Promise<SupplierAccount | null> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [supplierId]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Validate credit limit is positive
    if (creditLimit < 0) {
      throw new Error('El límite de crédito debe ser mayor o igual a 0');
    }

    return await this.accountRepository.updateCreditLimit(supplierId, creditLimit);
  }

  // ========== MOVEMENT METHODS ==========

  async getMovements(supplierId: number, filters: {
    page?: number;
    limit?: number;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [supplierId]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    return await this.accountRepository.getMovements(supplierId, filters);
  }

  async getMovementById(movementId: number): Promise<SupplierAccountMovement | null> {
    return await this.accountRepository.getMovementById(movementId);
  }

  async createMovement(data: CreateSupplierAccountMovementData): Promise<SupplierAccountMovement> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [data.supplier_id]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Validate amount is positive
    if (data.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Validate reference exists if provided
    if (data.reference_type && data.reference_id) {
      switch (data.reference_type) {
        case 'purchase':
          const purchaseQuery = `SELECT id FROM purchases WHERE id = ?`;
          const [purchase] = await executeQuery(purchaseQuery, [data.reference_id]);
          if (!purchase) {
            throw new Error('Orden de compra no encontrada');
          }
          break;

        case 'invoice':
          const invoiceQuery = `SELECT id FROM supplier_invoices WHERE id = ?`;
          const [invoice] = await executeQuery(invoiceQuery, [data.reference_id]);
          if (!invoice) {
            throw new Error('Factura no encontrada');
          }
          break;

        case 'payment':
          const paymentQuery = `SELECT id FROM payments WHERE id = ?`;
          const [payment] = await executeQuery(paymentQuery, [data.reference_id]);
          if (!payment) {
            throw new Error('Pago no encontrado');
          }
          break;
      }
    }

    return await this.accountRepository.createMovement(data);
  }

  async updateMovement(movementId: number, data: Partial<CreateSupplierAccountMovementData>): Promise<SupplierAccountMovement | null> {
    const movement = await this.accountRepository.getMovementById(movementId);
    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    return await this.accountRepository.updateMovement(movementId, {
      status: data.status,
      payment_date: data.payment_date,
      description: data.description
    } as any);
  }

  async deleteMovement(movementId: number): Promise<boolean> {
    const movement = await this.accountRepository.getMovementById(movementId);
    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    return await this.accountRepository.deleteMovement(movementId);
  }

  // ========== HELPER METHODS ==========

  async syncAccountBalances(supplierId: number): Promise<SupplierAccount | null> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [supplierId]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    return await this.accountRepository.updateAccountBalances(supplierId);
  }
}

