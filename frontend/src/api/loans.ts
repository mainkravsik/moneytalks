import { api } from './client'

export interface Loan {
  id: number
  loan_type: 'loan' | 'card'
  name: string
  bank: string | null
  original_amount: number | null
  remaining_amount: number
  interest_rate: number
  monthly_payment: number
  next_payment_date: string
  start_date: string | null
  is_active: boolean
  credit_limit: number | null
  grace_period_months: number | null
  min_payment_pct: number | null
  min_payment_floor: number | null
}

export interface StrategyResult {
  strategy: string; months_to_payoff: number
  total_interest: number; total_paid: number; extra: number
}

export interface PayoffResponse {
  snowball: StrategyResult; avalanche: StrategyResult
  savings_with_avalanche: number
}

export const fetchLoans = () => api.get<Loan[]>('/loans').then(r => r.data)
export const fetchPayoff = (extra = 0) =>
  api.get<PayoffResponse>(`/loans/payoff?extra=${extra}`).then(r => r.data)
export const recordPayment = (id: number, amount: number) =>
  api.post<Loan>(`/loans/${id}/payment`, { amount }).then(r => r.data)
export const createLoan = (data: Partial<Loan>) => api.post<Loan>('/loans', data).then(r => r.data)
export const updateLoan = (id: number, data: Partial<Loan>) => api.patch<Loan>(`/loans/${id}`, data).then(r => r.data)
export const deleteLoan = (id: number) => api.delete(`/loans/${id}`).then(r => r.data)
