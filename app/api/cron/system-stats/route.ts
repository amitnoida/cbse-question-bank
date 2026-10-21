import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../lib/system-stats-server";

export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !process.env.RESEND_API_KEY ||
    !process.env.ADMIN_EMAIL_FROM ||
    !process.env.SYSTEM_STATS_ALERT_EMAIL
  ) {
    return NextResponse.json({ error: "Email settings incomplete" }, { status: 503 });
  }

  const db = adminDb();
  const { data, error } = await db
    .from("system_usage_snapshots")
    .select("provider,metric_key,used,quota,unit,period_label,created_at")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    return NextResponse.json({ error: "Snapshot read failed" }, { status: 500 });
  }

  const seen = new Set<string>();
  let sent = 0;
  let skipped = 0;

  for (const row of data || []) {
    const key = row.provider + ":" + row.metric_key;
    if (seen.has(key)) continue;
    seen.add(key);

    // Do not send misleading alerts from snapshots older than 48 hours.
    if (Date.now() - new Date(row.created_at).getTime() > 48 * 3600 * 1000) {
      skipped++;
      continue;
    }

    const pct = (100 * Number(row.used)) / Number(row.quota);
    if (pct < 85) continue;

    const period = row.period_label || "unspecified";
    const { data: prior } = await db
      .from("system_alert_log")
      .select("id")
      .eq("provider", row.provider)
      .eq("metric_key", row.metric_key)
      .eq("period_label", period)
      .maybeSingle();

    if (prior) continue;

    const subject = `CBSE System Stats ALERT: ${row.provider} ${row.metric_key} ${pct.toFixed(1)}%`;
    const body = `Monitoring snapshot crossed 85% quota.\nProvider: ${row.provider}\nMetric: ${row.metric_key}\nUsed: ${row.used} ${row.unit}\nLimit: ${row.quota} ${row.unit}\nUsage: ${pct.toFixed(2)}%\nPeriod: ${period}\nSnapshot recorded: ${row.created_at}\n\nThis alert uses a recorded snapshot, not live billing data.`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.ADMIN_EMAIL_FROM,
          to: [process.env.SYSTEM_STATS_ALERT_EMAIL],
          subject,
          text: body,
        }),
      });

      if (!response.ok) {
        skipped++;
        continue;
      }

      const { error: logError } = await db
        .from("system_alert_log")
        .insert({ provider: row.provider, metric_key: row.metric_key, period_label: period });

      if (!logError) sent++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
