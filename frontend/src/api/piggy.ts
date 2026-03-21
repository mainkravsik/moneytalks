import { api } from './client'

export interface Piggy {
  id: number; name: string
  target_amount: number | null
  current_amount: number
  target_date: string | null
  is_active: boolean
}

export const fetchPiggies = () => api.get<Piggy[]>('/piggy').then(r => r.data)
export const createPiggy = (data: { name: string; target_amount?: number; target_date?: string }) =>
  api.post<Piggy>('/piggy', data).then(r => r.data)
export const contributePiggy = (id: number, amount: number) =>
  api.post<Piggy>(`/piggy/${id}/contribute`, { amount }).then(r => r.data)
export const deletePiggy = (id: number) => api.delete(`/piggy/${id}`)
