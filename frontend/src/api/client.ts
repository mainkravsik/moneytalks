import axios from 'axios'
import { retrieveLaunchParams } from '@telegram-apps/sdk'

function getInitData(): string {
  try {
    const { initDataRaw } = retrieveLaunchParams()
    return initDataRaw || ''
  } catch {
    // Dev mode outside Telegram
    return ''
  }
}

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use(config => {
  config.headers['X-Telegram-Init-Data'] = getInitData()
  return config
})
