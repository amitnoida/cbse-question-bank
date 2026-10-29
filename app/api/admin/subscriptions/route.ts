import { NextRequest, NextResponse } from "next/server";
import { noStore, requireStatsAdmin } from "../../../../lib/system-stats-server";
import { parseProductInput } from "../../../../lib/subscription-catalog";

const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: noStore});
export async function GET(req: NextRequest) {
  try {
    const admin = await requireStatsAdmin(req);
    if (!admin) return reply({error: "Sign in with an active administrator account."}, 401);
    if (admin.role !== "FULL_ADMIN") return reply({error: "Full Admin permission required."}, 403);
    const [products, history] = await Promise.all([
      admin.db.from("admin_subscription_products").select("code,name,class_numbers,price_inr,description,status,revision,updated_at").order("code"),
      admin.db.from("admin_subscription_product_audit").select("id,product_code,before_value,after_value,created_at").order("id", {ascending: false}).limit(30),
    ]);
    if (products.error || history.error) return reply({error: "Unable to load subscription catalogue."}, 500);
    return reply({products: products.data, history: history.data});
  } catch { return reply({error: "Unable to load subscription catalogue."}, 500); }
}
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireStatsAdmin(req);
    if (!admin) return reply({error: "Sign in with an active administrator account."}, 401);
    if (admin.role !== "FULL_ADMIN") return reply({error: "Full Admin permission required."}, 403);
    let body: unknown;
    try { body = await req.json(); } catch { return reply({error: "Invalid JSON."}, 400); }
    const input = parseProductInput(body);
    if (!input) return reply({error: "Check the name, price (up to two decimals), description and status. Ready plans need a price."}, 400);
    const {data, error} = await admin.db.rpc("admin_save_subscription_product_v1", {
      p_actor: admin.user.id, p_code: input.code, p_revision: input.revision,
      p_name: input.name, p_price: input.price_inr, p_description: input.description, p_status: input.status,
    });
    if (error?.code === "40001") return reply({error: "Another administrator changed this plan. Reload the catalogue before saving."}, 409);
    if (error?.code === "42501") return reply({error: "Full Admin permission required."}, 403);
    if (error) return reply({error: "Unable to save subscription plan."}, 500);
    return reply({product: data});
  } catch { return reply({error: "Unable to save subscription plan."}, 500); }
}
