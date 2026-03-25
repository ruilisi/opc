import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function computeOrder(above: number | null, below: number | null): number {
  if (above === null && below === null) return 1
  if (above === null) return below! / 2
  if (below === null) return above + 1
  return (above + below) / 2
}
