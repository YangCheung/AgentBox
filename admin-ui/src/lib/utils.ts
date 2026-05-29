import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString()
}

export function statusColor(status: string): string {
  switch (status) {
    case 'Running':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'Idle':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'Stopped':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    case 'Failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'Creating':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'Stopping':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
