"use client";



import { useCallback, useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";



type Stats = { admin_users?: number; total_students: number; free_students: number; paid_students: number; family_friends_students: number; completed_tests: number; active_coupons: number; redeemed_coupons: number };

type Coupon = { id: number; coupon_code: string; discount_percentage: number; is_active: boolean; valid_from: string | null; valid_until: string | null; usage_limit: number | null; usage_count: number | null; created_at: string | null; redeemed_student_id: string | null; redeemed_at: string | null };

type AdminUser = { user_id: string; email: string | null; full_name: string | null; is_active: boolean; created_at: string | null };

type Student = { student_id: string; student_name: string | null; class_name: string | null; email: string | null; membership: string; validity: string | null };

type CouponFilter = "all" | "available" | "redeemed" | "expired" | "inactive";

function couponStatus(c: Coupon): Exclude<CouponFilter, "all"> {

  if ((c.usage_count ?? 0) > 0) return "redeemed";

  if (c.valid_until && new Date(c.valid_until).getTime() <= Date.now()) return "expired";

  if (!c.is_active || (c.valid_from && new Date(c.valid_from).getTime() > Date.now())) return "inactive";

  if (c.usage_limit !== null && (c.usage_count ?? 0) >= c.usage_limit) return "redeemed";

  return "available";

}

const cards: { key: keyof Stats; label: string; icon: string }[] = [

  { key: "total_students", label: "Registered students", icon: "👥" },

  { key: "free_students", label: "Free students", icon: "📖" },

  { key: "paid_students", label: "Paid students", icon: "👑" },

  { key: "admin_users", label: "Admin users", icon: "🛡️" },

  { key: "active_coupons", label: "Available coupons", icon: "🎟️" },

  { key: "redeemed_coupons", label: "Redeemed coupons", icon: "✅" },

];



export default function AdminPage() {

  const [email, setEmail] = useState("cbse.exam.prep.guide@gmail.com");

  const [password, setPassword] = useState("");

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const [loading, setLoading] = useState(true);

  const [signingIn, setSigningIn] = useState(false);

  const [error, setError] = useState("");

  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [couponError, setCouponError] = useState("");

  const [discount, setDiscount] = useState(100);

  const [validDays, setValidDays] = useState(30);

  const [couponBusy, setCouponBusy] = useState(false);

  const [generatedCode, setGeneratedCode] = useState("");

  const [couponFilter, setCouponFilter] = useState<CouponFilter>("all");

  const [couponsOpen, setCouponsOpen] = useState(true);



  const [students, setStudents] = useState<Student[]>([]);

  const [studentsOpen, setStudentsOpen] = useState(false);

  const [studentsBusy, setStudentsBusy] = useState(false);

  const [studentsError, setStudentsError] = useState("");

  const [studentFilter, setStudentFilter] = useState<"all" | "free" | "paid">("all");

  const [studentSearch, setStudentSearch] = useState("");

  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const [adminsOpen, setAdminsOpen] = useState(false);

  const [adminsBusy, setAdminsBusy] = useState(false);

  const [adminsError, setAdminsError] = useState("");



  const refresh = useCallback(async () => {

    setError("");

    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {

      setUserEmail(null); setStats(null); setLoading(false); return;

    }

    setUserEmail(auth.user.email || "Signed in");

    const { data, error: rpcError } = await supabase.rpc("admin_dashboard_summary");

    if (rpcError) {

      setStats(null);

      setError(rpcError.message.includes("permission denied") || rpcError.message.includes("Not an active administrator")

        ? "This account is not authorized as an active administrator."

        : `Dashboard data could not be loaded: ${rpcError.message}. Run the included SQL setup first.`);

    } else {

      const record = Array.isArray(data) ? data[0] : data;

      const { data: countRows, error: countError } = await supabase.rpc("admin_portal_counts");

      if (countError) {

        setStats(null);

        setError(`Student and admin counts could not be loaded: ${countError.message}. Run admin_counts_and_users.sql first.`);

        setLoading(false);

        return;

      }

      const counts = Array.isArray(countRows) ? countRows[0] : countRows;

      if (!counts) {

        setStats(null);

        setError("No student counts were returned by admin_portal_counts.");

        setLoading(false);

        return;

      }

      setStats({ ...(record as Stats), total_students: Number(counts.total_students),

        free_students: Number(counts.free_students), paid_students: Number(counts.paid_students),

        admin_users: Number(counts.admin_users) });

      const { data: couponRows, error: listError } = await supabase.rpc("admin_coupon_list");

      if (listError) { setCouponError(`Coupon list: ${listError.message}. Run admin_phase2.sql first.`); setCoupons([]); }

      else { setCouponError(""); setCoupons((couponRows || []) as Coupon[]); }

    }

    setLoading(false);

  }, []);



  useEffect(() => {

    void refresh();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {

      // Avoid database calls while Supabase is processing its auth callback.

      window.setTimeout(() => void refresh(), 0);

    });

    return () => subscription.unsubscribe();

  }, [refresh]);



  async function loadStudents(filter: "all" | "free" | "paid" = studentFilter) {

    setStudentFilter(filter);

    setStudentsOpen(true);

    setStudentsBusy(true);

    setStudentsError("");

    const { data, error: listError } = await supabase.rpc("admin_student_directory");

    if (listError) {

      setStudentsError(listError.message);

      setStudents([]);

    } else {

      setStudents((data || []) as Student[]);

    }

    setStudentsBusy(false);

  }



  async function loadAdmins() {

    setAdminsOpen(true);

    setAdminsBusy(true);

    setAdminsError("");

    const { data, error: listError } = await supabase.rpc("admin_user_directory");

    if (listError) { setAdminsError(listError.message); setAdmins([]); }

    else setAdmins((data || []) as AdminUser[]);

    setAdminsBusy(false);

  }



  function showCoupons(filter: CouponFilter) {

    setCouponFilter(filter);

    setCouponsOpen(true);

    window.setTimeout(() => document.getElementById("admin-coupon-management")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);

  }



  async function signIn(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault(); setSigningIn(true); setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setPassword("");

    if (signInError) setError(signInError.message);

    else await refresh();

    setSigningIn(false);

  }

  async function createCoupon() {

    setCouponBusy(true); setCouponError(""); setGeneratedCode("");

    try {

      const { data, error: createError } = await supabase.rpc("admin_coupon_create", { p_discount: discount, p_valid_days: validDays });

      if (createError) throw createError;

      setGeneratedCode(String(data || ""));

      await refresh();

    } catch (e: any) { setCouponError(e?.message || "Unable to create coupon."); }

    finally { setCouponBusy(false); }

  }

  async function toggleCoupon(coupon: Coupon) {

    setCouponBusy(true); setCouponError("");

    try {

      const { data, error: updateError } = await supabase.rpc("admin_coupon_set_active", { p_coupon_id: coupon.id, p_active: !coupon.is_active });

      if (updateError) throw updateError;

      if (!data) throw new Error("This coupon cannot be changed (redeemed or expired).");

      await refresh();

    } catch (e: any) { setCouponError(e?.message || "Unable to update coupon."); }

    finally { setCouponBusy(false); }

  }

  async function signOut() {

    await supabase.auth.signOut(); setUserEmail(null); setStats(null); setCoupons([]); setStudents([]); setStudentsOpen(false); setAdmins([]); setAdminsOpen(false); setError("");

  }



  return (

    <main className="min-h-screen bg-[#f5f7fc] text-slate-900">

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">

          <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">CBSE Exam Prep Guide</p><h1 className="text-lg font-extrabold tracking-tight sm:text-xl">Admin Control Panel</h1></div>

          <div className="flex items-center gap-3"><a href="/" className="text-sm font-semibold text-indigo-700 hover:underline">← Website</a>{userEmail && <button onClick={signOut} className="rounded-lg border px-3 py-2 text-sm font-semibold">Sign out</button>}</div>

        </div>

      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">

        {loading ? <p>Checking administrator access…</p> : !userEmail ? (

          <section className="mx-auto max-w-md rounded-2xl border bg-white p-7 shadow-sm">

            <h2 className="mb-2 text-2xl font-bold">Administrator sign in</h2>

            <p className="mb-6 text-sm text-slate-600">Sign in with your authorized Supabase administrator account.</p>

            <form onSubmit={signIn} className="space-y-4">

              <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal" /></label>

              <label className="block text-sm font-semibold">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-3 font-normal" /></label>

              <button disabled={signingIn} className="w-full rounded-lg bg-indigo-700 px-4 py-3 font-bold text-white disabled:opacity-60">{signingIn ? "Signing in…" : "Sign in"}</button>

            </form>

          </section>

        ) : (

          <>

            <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Overview</h2><p className="text-sm text-slate-600">Signed in as {userEmail}</p></div>{stats && <button onClick={() => {setLoading(true);void refresh();}} className="rounded-lg border bg-white px-4 py-2 font-semibold">Refresh</button>}</div>

            {stats && <><div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{cards.map(card => {

  const filter = card.key === "total_students" ? "all" : card.key === "free_students" ? "free" : card.key === "paid_students" ? "paid" : null;

  return <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm shadow-slate-200/60 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-600 sm:text-sm">{card.label}</p><span>{card.icon}</span></div><p className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{Number(stats[card.key] ?? 0).toLocaleString()}</p>{filter && <button type="button" onClick={() => void loadStudents(filter)} className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-indigo-700 underline underline-offset-2 sm:text-sm">View students →</button>}{(card.key === "active_coupons" || card.key === "redeemed_coupons") && <button type="button" onClick={() => showCoupons(card.key === "active_coupons" ? "available" : "redeemed")} className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-indigo-700 underline underline-offset-2 sm:text-sm">View coupons →</button>}{card.key === "admin_users" && <button type="button" onClick={() => void loadAdmins()} className="mt-3 inline-flex min-h-9 items-center text-xs font-bold text-indigo-700 underline underline-offset-2 sm:text-sm">View admins →</button>}</article>;

})}</div>

{adminsOpen && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:mt-7 sm:p-6">

  <div className="flex flex-wrap items-center justify-between gap-3">

    <div><h3 className="text-lg font-extrabold sm:text-xl">🛡️ Admin Users</h3><p className="mt-1 text-sm text-slate-600">Read-only list of authorized administrator accounts.</p></div>

    <div className="flex gap-2"><button type="button" onClick={() => void loadAdmins()} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh list</button><button type="button" onClick={() => setAdminsOpen(false)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">Hide admins</button></div>

  </div>

  {adminsError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{adminsError}</p>}

  {adminsBusy ? <p className="mt-4 text-sm">Loading administrators…</p> : <><div className="mt-4 space-y-3 md:hidden">{admins.map(a => <article key={a.user_id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-2"><p className="font-bold">{a.full_name || "Not provided"}</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{a.is_active ? "Active" : "Inactive"}</span></div><p className="mt-2 break-all text-sm text-slate-600">{a.email || "—"}</p><p className="mt-2 text-xs text-slate-500">Added {a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN") : "—"}</p></article>)}{!admins.length && !adminsError && <p className="p-4 text-center text-sm text-slate-500">No administrators found.</p>}</div><div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Full name</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Added on</th></tr></thead><tbody>{admins.map(a => <tr key={a.user_id} className="border-b"><td className="p-3 font-semibold">{a.full_name || "Not provided"}</td><td className="p-3 break-all">{a.email || "—"}</td><td className="p-3">{a.is_active ? "Active" : "Inactive"}</td><td className="p-3">{a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN") : "—"}</td></tr>)}{admins.length === 0 && !adminsError && <tr><td colSpan={4} className="p-5 text-center text-slate-500">No administrators found.</td></tr>}</tbody></table></div></>}

</section>}

<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:mt-7 sm:p-6">

  <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold sm:text-xl">👥 Student Directory</h3><p className="mt-1 text-sm text-slate-600">Student names, classes, email addresses and subscription validity.</p></div><button type="button" onClick={() => studentsOpen ? setStudentsOpen(false) : void loadStudents("all")} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">{studentsOpen ? "Hide students" : "View all students"}</button></div>

  {studentsOpen && <>

    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"><input aria-label="Search students" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search name or email" className="min-w-0 w-full flex-1 rounded-xl border border-slate-300 bg-white p-3 sm:min-w-[210px]" /><select aria-label="Membership filter" value={studentFilter} onChange={e => setStudentFilter(e.target.value as "all" | "free" | "paid")} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2"><option value="all">All students</option><option value="free">Free students</option><option value="paid">Paid students</option></select><button type="button" onClick={() => void loadStudents()} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh list</button></div>

    {studentsError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{studentsError}. Run admin_student_directory.sql in Supabase SQL Editor first.</p>}

    {studentsBusy ? <p className="mt-4 text-sm">Loading students…</p> : <><div className="mt-4 space-y-3 md:hidden">{students.filter(st => (studentFilter === "all" || st.membership.toLowerCase() === studentFilter) && `${st.student_name || ""} ${st.email || ""}`.toLowerCase().includes(studentSearch.trim().toLowerCase())).map(st => <article key={st.student_id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-slate-900">{st.student_name || "Not provided"}</p><p className="mt-1 break-all text-xs text-slate-500">{st.email || "—"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.membership.toLowerCase() === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{st.membership}</span></div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs"><div><p className="text-slate-500">Class</p><p className="mt-1 font-semibold">{st.class_name || "Not selected"}</p></div><div><p className="text-slate-500">Validity</p><p className="mt-1 font-semibold">{st.membership === "Paid" ? (st.validity ? new Date(st.validity).toLocaleDateString("en-IN") : "No expiry") : "Free plan"}</p></div></div></article>)}{!students.some(st => (studentFilter === "all" || st.membership.toLowerCase() === studentFilter) && `${st.student_name || ""} ${st.email || ""}`.toLowerCase().includes(studentSearch.trim().toLowerCase())) && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">No students found.</p>}</div><div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Student name</th><th className="p-3">Class</th><th className="p-3">Email</th><th className="p-3">Free / Paid</th><th className="p-3">Validity</th></tr></thead><tbody>{students.filter(st => (studentFilter === "all" || st.membership.toLowerCase() === studentFilter) && `${st.student_name || ""} ${st.email || ""}`.toLowerCase().includes(studentSearch.trim().toLowerCase())).map(st => <tr key={st.student_id} className="border-b"><td className="p-3 font-semibold">{st.student_name || "Not provided"}</td><td className="p-3">{st.class_name || "Class not selected"}</td><td className="p-3 break-all">{st.email || "—"}</td><td className="p-3">{st.membership}</td><td className="p-3">{st.membership === "Paid" ? (st.validity ? new Date(st.validity).toLocaleDateString("en-IN") : "No expiry") : (st.validity ? `Expired ${new Date(st.validity).toLocaleDateString("en-IN")}` : "Free plan")}</td></tr>)}{students.filter(st => (studentFilter === "all" || st.membership.toLowerCase() === studentFilter) && `${st.student_name || ""} ${st.email || ""}`.toLowerCase().includes(studentSearch.trim().toLowerCase())).length === 0 && <tr><td colSpan={5} className="p-5 text-center text-slate-500">No students found.</td></tr>}</tbody></table></div></>}

  </>}

</section>

<section id="admin-coupon-management" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:mt-7 sm:p-6">

  <div className="flex flex-wrap items-center justify-between gap-3">

    <h3 className="text-lg font-extrabold sm:text-xl">🎟️ Coupon Management</h3>

    <button type="button" onClick={() => setCouponsOpen(!couponsOpen)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{couponsOpen ? "Hide coupons" : "Show coupons"}</button>

  </div>

  {couponsOpen && <>

  <p className="mt-1 text-sm text-slate-600">Every generated coupon has a one-student redemption limit. Only 100% coupons activate membership without payment.</p>

  <div className="mt-5 flex flex-wrap items-end gap-3">

    <label className="text-sm font-semibold">Discount<select value={discount} onChange={e=>setDiscount(Number(e.target.value))} className="mt-1 block rounded-lg border bg-white p-2"><option value={100}>100%</option><option value={50}>50%</option><option value={20}>20%</option></select></label>

    <label className="text-sm font-semibold">Expires after<select value={validDays} onChange={e=>setValidDays(Number(e.target.value))} className="mt-1 block rounded-lg border bg-white p-2"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>

    <button disabled={couponBusy} onClick={()=>void createCoupon()} className="min-h-11 w-full rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50 sm:w-auto">{couponBusy?"Working…":"Generate unique coupon"}</button>

  </div>

  {generatedCode && <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900"><strong>New coupon:</strong> <code className="ml-2 font-bold">{generatedCode}</code><button className="ml-4 underline" onClick={()=>void navigator.clipboard.writeText(generatedCode)}>Copy</button></div>}

  {couponError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{couponError}</p>}

  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">

    <label htmlFor="coupon-filter" className="text-sm font-semibold">Show coupons:</label>

    <select id="coupon-filter" value={couponFilter} onChange={e => setCouponFilter(e.target.value as CouponFilter)} className="rounded-lg border bg-white px-3 py-2 text-sm">

      <option value="all">All coupons</option>

      <option value="available">Available</option>

      <option value="redeemed">Redeemed</option>

      <option value="expired">Expired</option>

      <option value="inactive">Inactive / not yet active</option>

    </select>

    <span className="text-sm text-slate-600">{coupons.filter(c => couponFilter === "all" || couponStatus(c) === couponFilter).length} shown</span>

  </div>

  <div className="mt-5 space-y-3 md:hidden">{coupons.filter(c => couponFilter === "all" || couponStatus(c) === couponFilter).map(c => {const status=couponStatus(c); const used=(c.usage_count||0)>0; const expired=!!c.valid_until&&new Date(c.valid_until).getTime()<Date.now();return <article key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><code className="break-all text-sm font-bold text-indigo-800">{c.coupon_code}</code><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === "available" ? "bg-emerald-100 text-emerald-800" : status === "redeemed" ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-700"}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Discount</p><p className="mt-1 font-bold">{c.discount_percentage}%</p></div><div><p className="text-slate-500">Used</p><p className="mt-1 font-bold">{c.usage_count||0}/{c.usage_limit??"∞"}</p></div><div><p className="text-slate-500">Expires</p><p className="mt-1 font-bold">{c.valid_until?new Date(c.valid_until).toLocaleDateString("en-IN"):"No expiry"}</p></div></div>{c.redeemed_student_id&&<p className="mt-3 break-all text-xs text-slate-500">Redeemed by: {c.redeemed_student_id}</p>}<button type="button" disabled={couponBusy||used||expired} onClick={()=>void toggleCoupon(c)} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40">{c.is_active?"Deactivate coupon":"Activate coupon"}</button></article>})}{!coupons.some(c => couponFilter === "all" || couponStatus(c) === couponFilter) && <p className="p-4 text-center text-sm text-slate-500">No coupons match this filter.</p>}</div><div className="mt-6 hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Code</th><th className="p-3">Discount</th><th className="p-3">Expiry</th><th className="p-3">Usage</th><th className="p-3">Status</th><th className="p-3">Redeemed by</th><th className="p-3">Action</th></tr></thead><tbody>{coupons.filter(c => couponFilter === "all" || couponStatus(c) === couponFilter).map(c=>{const used=(c.usage_count||0)>0;const expired=!!c.valid_until&&new Date(c.valid_until).getTime()<Date.now();return <tr key={c.id} className="border-b"><td className="p-3 font-mono font-semibold">{c.coupon_code}</td><td className="p-3">{c.discount_percentage}%</td><td className="p-3">{c.valid_until?new Date(c.valid_until).toLocaleDateString("en-IN"):"No expiry"}</td><td className="p-3">{c.usage_count||0}/{c.usage_limit??"∞"}</td><td className="p-3">{used?"Redeemed":expired?"Expired":c.is_active?"Available":"Inactive"}</td><td className="p-3 text-xs">{c.redeemed_student_id?<><span className="break-all">{c.redeemed_student_id}</span>{c.redeemed_at&&<div>{new Date(c.redeemed_at).toLocaleString("en-IN")}</div>}</>:"—"}</td><td className="p-3"><button disabled={couponBusy||used||expired} onClick={()=>void toggleCoupon(c)} className="rounded border px-3 py-1.5 font-semibold disabled:opacity-40">{c.is_active?"Deactivate":"Activate"}</button></td></tr>})}{coupons.filter(c => couponFilter === "all" || couponStatus(c) === couponFilter).length===0&&<tr><td colSpan={7} className="p-5 text-center text-slate-500">No coupons match this filter.</td></tr>}</tbody></table></div>

</>}</section></>}

          </>

        )}

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

      </div>

    </main>

  );

}
