// Supabase errors may be plain objects rather than Error instances.
export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return "";
}
