import { api } from './client'

export interface RatePeriod {
  id?: number
  loan_id?: number
  rate: number
  start_date: string
  end_date: string | null
}

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
  rate_periods: RatePeriod[]
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

export const fetchPayments = (id: number) =>
  api.get<{id: number; amount: number; paid_at: string}[]>(`/loans/${id}/payments`).then(r => r.data)

export const fetchSchedule = (id: number) =>
  api.get<{
    schedule: {month: number; date: string; payment: number; principal: number; interest: number; balance: number}[]
    total_months: number; total_interest: number; total_paid: number
  }>(`/loans/${id}/schedule`).then(r => r.data)

export interface SmartAllocation {
  loan_id: number
  loan_name: string
  bank: string | null
  loan_type: string
  rate: number
  label: string
  amount: number
  savings: number
}

export interface SmartDistributeResponse {
  total_amount: number
  unallocated: number
  total_savings: number
  allocations: SmartAllocation[]
}

export const fetchSmartDistribute = (amount: number) =>
  api.get<SmartDistributeResponse>(`/loans/smart-distribute?amount=${amount}`).then(r => r.data)

export const fetchEarlyPayoff = (id: number, extra: number) =>
  api.get<{
    normal: {months: number; total_interest: number; total_paid: number}
    with_extra: {months: number; total_interest: number; total_paid: number; extra_per_month: number}
    savings: {months_saved: number; interest_saved: number}
  }>(`/loans/${id}/early-payoff?extra=${extra}`).then(r => r.data)
