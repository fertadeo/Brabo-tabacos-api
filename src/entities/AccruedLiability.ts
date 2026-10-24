// =====================================================
// ENTITIES - ACCRUED LIABILITIES MODULE
// Pasivos Devengados
// =====================================================

export type LiabilityType = 'impuesto' | 'alquiler' | 'seguro' | 'servicio' | 'prestamo' | 'otro';
export type LiabilityStatus = 'pending' | 'partial_paid' | 'paid' | 'overdue' | 'cancelled';

export interface AccruedLiability {
  id: number;
  liability_number: string;
  liability_type: LiabilityType;
  description: string;
  amount: number;
  accrual_date: string;
  due_date: string;
  payment_date?: string;
  status: LiabilityStatus;
  paid_amount: number;
  remaining_amount: number;
  treasury_account_id?: number;
  payment_id?: number;
  notes?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  
  // Relaciones opcionales
  payments?: AccruedLiabilityPayment[];
  treasury_account?: any;
}

export interface CreateAccruedLiabilityData {
  liability_number?: string; // Opcional, se genera si no se proporciona
  liability_type: LiabilityType;
  description: string;
  amount: number;
  accrual_date: string;
  due_date: string;
  treasury_account_id?: number;
  notes?: string;
}

export interface UpdateAccruedLiabilityData {
  liability_type?: LiabilityType;
  description?: string;
  amount?: number;
  accrual_date?: string;
  due_date?: string;
  payment_date?: string;
  status?: LiabilityStatus;
  paid_amount?: number;
  remaining_amount?: number;
  treasury_account_id?: number;
  notes?: string;
}

export interface AccruedLiabilityPayment {
  id: number;
  liability_id: number;
  payment_id: number;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
  
  // Relaciones opcionales
  payment?: any;
}

export interface LinkPaymentToLiabilityData {
  payment_id: number;
  amount: number;
  payment_date: string;
  notes?: string;
}

