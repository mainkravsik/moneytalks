import { create } from 'zustand'
import { BudgetCurrent, fetchBudgetCurrent } from '../api/budget'

interface BudgetStore {
  data: BudgetCurrent | null
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
}

export const useBudgetStore = create<BudgetStore>(set => ({
  data: null,
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchBudgetCurrent()
      set({ data, loading: false })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка загрузки'
      set({ error: msg, loading: false })
    }
  },
}))
