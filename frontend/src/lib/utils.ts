import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createCellSlug(brand: string, model: string): string {
  const text = `${brand}-${model}`;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres estranhos por hifens
    .replace(/(^-|-$)+/g, '');   // Remove hifens no início ou fim
}