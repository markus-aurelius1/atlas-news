/** Local-day changes refresh derived views at midnight and after sleep, without timer ticks. */
import { useEffect, useState } from 'react'
import { todayKey } from './time'
import { onWake } from '@/services/lifecycle'

export function useDay() {
  const [day, setDay] = useState(todayKey)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      setDay(todayKey())
      clearTimeout(timer)
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      timer = setTimeout(check, Math.max(1000, midnight.getTime() - Date.now() + 50))
    }
    check()
    const stop = onWake(check)
    return () => { clearTimeout(timer); stop() }
  }, [])
  return day
}
