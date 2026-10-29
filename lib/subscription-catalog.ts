export const productCodes = ["CLASS_8", "CLASS_9", "CLASS_10", "CLASS_11", "CLASS_12", "COMBO_9_10", "COMBO_11_12"] as const;
export type SubscriptionProduct = {
  code: string; name: string; class_numbers: number[]; price_inr: number | null;
  description: string; status: "draft" | "ready"; revision: number; updated_at: string;
};
export type ProductInput = { code: string; revision: number; name: string; price_inr: number | null; description: string; status: "draft" | "ready" };
export function parseProductInput(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (!productCodes.some(code => code === b.code) || typeof b.revision !== "number" || !Number.isSafeInteger(b.revision) || b.revision < 1) return null;
  if (typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 120 || typeof b.description !== "string" || b.description.length > 1000) return null;
  if (b.status !== "draft" && b.status !== "ready") return null;
  const price = b.price_inr;
  if (price !== null && (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001)) return null;
  if (b.status === "ready" && price === null) return null;
  return {code: b.code as string, revision: b.revision, name: b.name.trim(), price_inr: price as number | null, description: b.description, status: b.status};
}
