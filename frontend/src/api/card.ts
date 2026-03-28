import { api } from './client'

export interface CardCharge {
  id: number
  loan_id: number
  amount: number
  description: string
  charge_type: 'purchase' | 'transfer' | 'cash'
  charge_date: string
  grace_deadline: string | null
  is_paid: boolean
  status: 'in_grace' | 'overdue' | 'paid' | 'no_grace'
}

export interface GraceBucket {
  deadline: string
  total: number
  is_overdue: boolean
}

export interface CardSummary {
  total_debt: number
  grace_buckets: GraceBucket[]
  non_grace_debt: number
  accrued_interest: number
  min_payment: number
  available: number
}

export interface CardPayoffMonth {
  month: string
  debt_start: number
  payment: number
  interest: number
  debt_end: number
}

export interface CardPayoffResponse {
  months: CardPayoffMonth[]
  total_months: number
  total_interest: number
  total_paid: number
  recommendations: { zero_interest: number; close_in_6: number; close_in_12: number }
}

export const fetchCharges = (loanId: number, month?: string) =>
  api.get<CardCharge[]>(`/loans/${loanId}/charges${month ? `?month=${month}` : ''}`).then(r => r.data)

export const addCharge = (loanId: number, data: { amount: number; description: string; charge_type: string; charge_date: string }) =>
  api.post<CardCharge>(`/loans/${loanId}/charges`, data).then(r => r.data)

export const deleteCharge = (loanId: number, chargeId: number) =>
  api.delete(`/loans/${loanId}/charges/${chargeId}`).then(r => r.data)

export const fetchCardSummary = (loanId: number) =>
  api.get<CardSummary>(`/loans/${loanId}/card-summary`).then(r => r.data)

export const fetchCardPayoff = (loanId: number, monthlyPayment: number) =>
  api.get<CardPayoffResponse>(`/loans/${loanId}/card-payoff?monthly_payment=${monthlyPayment}`).then(r => r.data)
