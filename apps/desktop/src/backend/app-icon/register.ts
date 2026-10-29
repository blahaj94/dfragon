import { app, BrowserWindow } from 'electron'
import afternoonIcon from '../../../resources/time-of-day/afternoon.png?asset'
import dawnIcon from '../../../resources/time-of-day/dawn.png?asset'
import dayIcon from '../../../resources/time-of-day/day.png?asset'
import nightIcon from '../../../resources/time-of-day/night.png?asset'
import { readTimeOfDay, type TimeOfDay } from './time-of-day'

// 절전에서 깨어나거나 시스템 시간대를 바꿔도 다음 확인에서 바로 맞춘다.
const CHECK_INTERVAL_MS = 60 * 1000

const ICONS: Record<TimeOfDay, string> = {
  night: nightIcon,
  dawn: dawnIcon,
  day: dayIcon,
  afternoon: afternoonIcon
}

export function readAppIcon(): string {
  return ICONS[readTimeOfDay(new Date().getHours())]
}

export function registerTimeOfDayIcon(): () => void {
  let current = readAppIcon()
  applyIcon(current)
  const timer = setInterval(() => {
    const next = readAppIcon()
    if (next === current) {
      return
    }
    current = next
    applyIcon(next)
  }, CHECK_INTERVAL_MS)

  return () => clearInterval(timer)
}

function applyIcon(icon: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.setIcon(icon)
    }
  }
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }
}
