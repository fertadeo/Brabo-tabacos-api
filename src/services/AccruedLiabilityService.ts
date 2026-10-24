import { AccruedLiabilityRepository } from '../repositories/AccruedLiabilityRepository';
import { executeQuery } from '../config/database';
import {
  AccruedLiability,
  CreateAccruedLiabilityData,
  UpdateAccruedLiabilityData,
  AccruedLiabilityPayment
} from '../entities/AccruedLiability';

export class AccruedLiabilityService {
  private liabilityRepository: AccruedLiabilityRepository;

  constructor() {
    this.liabilityRepository = new AccruedLiabilityRepository();
  }

  // ========== LIABILITY METHODS ==========

  async getAllLiabilities(filters: {
    page?: number;
    limit?: number;
    search?: string;
    liability_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return await this.liabilityRepository.getAllLiabilities(filters);
  }

  async getLiabilityById(id: number): Promise<AccruedLiability | null> {
    return await this.liabilityRepository.getLiabilityById(id);
  }

  async createLiability(data: CreateAccruedLiabilityData, userId?: number): Promise<AccruedLiability> {
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

    return await this.liabilityRepository.createLiability(data, userId);
  }

  async updateLiability(id: number, data: UpdateAccruedLiabilityData): Promise<AccruedLiability | null> {
    const existingLiability = await this.liabilityRepository.getLiabilityById(id);
    if (!existingLiability) {
      throw new Error('Pasivo devengado no encontrado');
    }

    // Validate amount is positive if being changed
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Validate dates if being changed
    const accrualDate = data.accrual_date 
      ? new Date(data.accrual_date) 
      : new Date(existingLiability.accrual_date);
    const dueDate = data.due_date 
      ? new Date(data.due_date) 
      : existingLiability.due_date ? new Date(existingLiability.due_date) : null;

    if (dueDate && dueDate < accrualDate) {
      throw new Error('La fecha de vencimiento debe ser posterior a la fecha de devengamiento');
    }

    // Check if liability has payments and trying to change amount
    if (data.amount !== undefined && existingLiability.paid_amount > 0) {
      if (data.amount < existingLiability.paid_amount) {
        throw new Error(`No se puede reducir el monto por debajo del monto pagado (${existingLiability.paid_amount})`);
      }
    }

    return await this.liabilityRepository.updateLiability(id, data);
  }

  async deleteLiability(id: number): Promise<boolean> {
    const liability = await this.liabilityRepository.getLiabilityById(id);
    if (!liability) {
      throw new Error('Pasivo devengado no encontrado');
    }

    // Check if liability has payments
    if (liability.paid_amount > 0) {
      throw new Error('No se puede eliminar un pasivo devengado que tiene pagos asociados');
    }

    return await this.liabilityRepository.deleteLiability(id);
  }

  // ========== PAYMENT METHODS ==========

  async getLiabilityPayments(liabilityId: number): Promise<AccruedLiabilityPayment[]> {
    const liability = await this.liabilityRepository.getLiabilityById(liabilityId);
    if (!liability) {
      throw new Error('Pasivo devengado no encontrado');
    }

    return await this.liabilityRepository.getLiabilityPayments(liabilityId);
  }

  async linkPaymentToLiability(liabilityId: number, paymentId: number, amount: number): Promise<AccruedLiabilityPayment> {
    const liability = await this.liabilityRepository.getLiabilityById(liabilityId);
    if (!liability) {
      throw new Error('Pasivo devengado no encontrado');
    }

    // Validate payment exists
    const paymentQuery = `
      SELECT id, amount, payment_date, status, type 
      FROM payments 
      WHERE id = ?
    `;
    const [payment] = await executeQuery(paymentQuery, [paymentId]);

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    // Validate payment is an outflow
    if (payment.type !== 'outflow') {
      throw new Error('El pago debe ser una salida de dinero');
    }

    // Validate payment status
    if (payment.status !== 'posted') {
      throw new Error('El pago debe estar confirmado (posted) para ser vinculado');
    }

    // Validate amount is positive
    if (amount <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Validate amount doesn't exceed payment amount
    if (amount > payment.amount) {
      throw new Error(`El monto (${amount}) excede el monto del pago (${payment.amount})`);
    }

    // Validate amount doesn't exceed remaining liability amount
    const remainingAmount = liability.remaining_amount || liability.amount;
    if (amount > remainingAmount) {
      throw new Error(`El monto (${amount}) excede el monto pendiente del pasivo (${remainingAmount})`);
    }

    // Link payment
    const linkedPayment = await this.liabilityRepository.linkPaymentToLiability(liabilityId, paymentId, amount);

    // Update liability payment status
    await this.liabilityRepository.updateLiabilityPaymentStatus(liabilityId);

    return linkedPayment;
  }

  async unlinkPaymentFromLiability(liabilityId: number, paymentId: number): Promise<boolean> {
    const liability = await this.liabilityRepository.getLiabilityById(liabilityId);
    if (!liability) {
      throw new Error('Pasivo devengado no encontrado');
    }

    // Validate payment link exists
    const payments = await this.liabilityRepository.getLiabilityPayments(liabilityId);
    const paymentLink = payments.find(p => p.payment_id === paymentId);

    if (!paymentLink) {
      throw new Error('El pago no está vinculado a este pasivo');
    }

    // Unlink payment
    const unlinked = await this.liabilityRepository.unlinkPaymentFromLiability(liabilityId, paymentId);

    if (unlinked) {
      // Update liability payment status
      await this.liabilityRepository.updateLiabilityPaymentStatus(liabilityId);
    }

    return unlinked;
  }
}

