import { ClipFilters } from "@/lib/types";

export function hasActiveFilters(filters: ClipFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}
