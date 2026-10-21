import { NextRequest, NextResponse } from "next/server";
import { requireStatsAdmin, noStore } from "../../../../lib/system-stats-server";

const fail = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: noStore });

export async function GET(req: NextRequest) {
  try {
    const a = await requireStatsAdmin(req);
    if (!a) return fail("Unauthorized", 401);

    const [live, snapshots] = await Promise.all([
      a.db.rpc("system_stats_db_readonly"),
      a.db
        .from("system_usage_snapshots")
        .select("provider,metric_key,used,quota,unit,scope,period_label,measured_at,created_at")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    if (live.error || snapshots.error)
      return fail(live.error?.message || snapshots.error?.message || "Read failed", 500);

    const seen = new Set<string>();
    const latest = (snapshots.data || []).filter((x) => {
      const k = x.provider + ":" + x.metric_key;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return NextResponse.json(
      { database: live.data, usage: latest, as_of: new Date().toISOString() },
      { headers: noStore }
    );
  } catch {
    return fail("Unable to retrieve monitoring data", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = await requireStatsAdmin(req);
    if (!a) return fail("Unauthorized", 401);
    if (a.role !== "FULL_ADMIN") return fail("Full Admin required to record usage", 403);

    const b = await req.json();
    const provider = String(b.provider || "");
    const metric_key = String(b.metric_key || "");
    const unit = String(b.unit || "");
    const scope = String(b.scope || "organization").slice(0, 60);
    const period_label = String(b.period_label || "").slice(0, 100);
    const used = Number(b.used);
    const quota = Number(b.quota);

    if (
      !["supabase", "vercel"].includes(provider) ||
      !/^[a-z0-9_]{2,60}$/.test(metric_key) ||
      !["MB", "GB", "count", "seconds"].includes(unit) ||
      !Number.isFinite(used) ||
      used < 0 ||
      !Number.isFinite(quota) ||
      quota <= 0
    )
      return fail("Invalid usage input", 400);

    const { error } = await a.db
      .from("system_usage_snapshots")
      .insert({ provider, metric_key, used, quota, unit, scope, period_label });

    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail("Unable to save snapshot", 500);
  }
}
