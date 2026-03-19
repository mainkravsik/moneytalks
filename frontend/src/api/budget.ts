import { api } from './client'

export interface CategoryBudget {
  category: { id: number; name: string; emoji: string; is_active: boolean }
  limit: number
  spent: number
  remaining: number
  percent_used: number
}

export interface BudgetCurrent {
  period_year: number
  period_month: number
  start_date: string
  end_date: string
  total_limit: number
  total_spent: number
  safe_to_spend: number
  categories: CategoryBudget[]
}

export const fetchBudgetCurrent = (): Promise<BudgetCurrent> =>
  api.get<BudgetCurrent>('/budget/current').then(r => r.data)

export const addTransaction = (data: {
  category_id: number
  amount: number
  comment?: string
}): Promise<void> => api.post('/transactions', data)

export const updateLimits = (
  updates: { category_id: number; limit_amount: number }[]
): Promise<void> => api.patch('/budget/limits', updates)
