"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { productCodes, type SubscriptionProduct } from "../../../lib/subscription-catalog";

type Audit = {id: number; product_code: string; created_at: string; before_value: SubscriptionProduct; after_value: SubscriptionProduct};
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
const button = "min-h-11 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const priceLabel = (p: number | null) => p === null ? "Not set" : new Intl.NumberFormat("en-IN", {style: "currency", currency: "INR"}).format(p);
async function request(body?: unknown) {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session) throw Error("Sign in through the Admin dashboard first.");
  const r = await fetch("/api/admin/subscriptions", {
    method: body === undefined ? "GET" : "PATCH", cache: "no-store",
    headers: {Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json"},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed.");
  return data;
}
function ProductEditor({product, onSaved}: {product: SubscriptionProduct; onSaved: (p: SubscriptionProduct) => void}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price_inr === null ? "" : String(product.price_inr));
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState(product.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const data = await request({code: product.code, revision: product.revision, name, price_inr: price.trim() === "" ? null : Number(price), description, status});
      onSaved(data.product);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }
  const dirty = name !== product.name || price !== (product.price_inr === null ? "" : String(product.price_inr)) || description !== product.description || status !== product.status;
  return <form onSubmit={save} className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={`Edit ${product.code}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold">Class {product.class_numbers.join(" + ")}</h2><p className="text-xs text-slate-500">{product.class_numbers.length > 1 ? "Combo membership" : "Single-class membership"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{product.status === "ready" ? "Configured" : "Draft"}</span></div>
    <p className="text-sm text-slate-600">Includes Practice and Real Mock</p>
    <label className="block text-sm font-medium">Plan name<input required maxLength={120} className={field} value={name} onChange={e => {setName(e.target.value);}} /></label>
    <label className="block text-sm font-medium">Price (INR)<input type="number" min="0" max="999999.99" step="0.01" placeholder="Not set" required={status === "ready"} className={field} value={price} onChange={e => {setPrice(e.target.value);}} /></label>
    <label className="block text-sm font-medium">Description<textarea maxLength={1000} rows={2} className={field} value={description} onChange={e => {setDescription(e.target.value);}} /></label>
    <label className="block text-sm font-medium">Configuration status<select className={field} value={status} onChange={e => {setStatus(e.target.value as "draft" | "ready");}}><option value="draft">Draft</option><option value="ready">Configured — price agreed</option></select></label>
    <p className="text-xs text-slate-500">Configured plans remain admin-only until the student subscription release.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button className={button} disabled={busy || !dirty}>{busy ? "Saving…" : "Save plan"}</button>
    <p className="text-xs text-slate-500">Saved price: {priceLabel(product.price_inr)}</p>
  </form>;
}
export default function SubscriptionPlansPage() {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [history, setHistory] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await request(); setProducts(data.products); setHistory(data.history); }
    catch (e) {setProducts([]); setHistory([]); setError(e instanceof Error ? e.message : "Unable to load.");}
    finally {setLoading(false);}
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function onSaved(p: SubscriptionProduct) {
    setProducts(rows => rows.map(row => row.code === p.code ? p : row));
    setMessage(`${p.name} saved successfully.`);
    try {const data = await request(); setHistory(data.history);} catch {setMessage(`${p.name} saved. Reload to refresh change history.`);}
  }
  return <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-slate-50 p-4 text-slate-900 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin" className="text-sm font-semibold text-indigo-700">← Admin dashboard</Link><h1 className="mt-3 text-3xl font-extrabold">Subscription plans</h1><p className="mt-1 text-slate-600">Full Admin · Classes 8–12 · Five class plans and two combos</p></div><button className={button} disabled={loading} onClick={() => void load()}>Reload catalogue</button></header>
    <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm">Prepare plan names, prices and descriptions here. Saving configures the future catalogue. Current student memberships, coupons and access remain in their existing flow. Validity and activation dates will be agreed for the student release.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    {loading ? <p>Loading subscription catalogue…</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[...products].sort((a,b) => productCodes.indexOf(a.code as typeof productCodes[number]) - productCodes.indexOf(b.code as typeof productCodes[number])).map(p => <ProductEditor key={`${p.code}:${p.revision}`} product={p} onSaved={p => void onSaved(p)} />)}</div>}
    {products.length > 0 && <section className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Recent changes</h2><p className="mt-1 text-sm text-slate-500">Latest 30 saves · times shown in India Standard Time</p><ul className="mt-4 divide-y">{history.map(a => <li key={a.id} className="py-3 text-sm"><strong>{a.after_value.name}</strong><p>{priceLabel(a.before_value.price_inr)} → {priceLabel(a.after_value.price_inr)} · {a.before_value.status} → {a.after_value.status}</p><p className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString("en-IN", {timeZone: "Asia/Kolkata"})} · Revision {a.after_value.revision}</p></li>)}</ul>{!history.length && <p className="mt-3 text-sm text-slate-500">No changes yet.</p>}</section>}
  </main>;
}
