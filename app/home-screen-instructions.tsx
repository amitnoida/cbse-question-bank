export default function HomeScreenInstructions() {
  return <section aria-labelledby="home-screen-heading" className="mx-auto max-w-6xl px-5 py-10 text-slate-900">
    <h2 id="home-screen-heading" className="text-2xl font-extrabold">Add ExamShuru to your home screen</h2>
    <p className="mt-3 text-sm leading-7 text-slate-600">Open ExamShuru directly from your home screen. No Play Store or App Store download needed. Internet is required for quizzes and sign-in.</p>
    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="min-h-11 cursor-pointer font-bold">View Android and iPhone instructions</summary>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <section><h3 className="font-bold">Android · Chrome</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6"><li>Open examshuru.com in Chrome.</li><li>Tap the three-dot menu (⋮).</li><li>Choose Add to Home screen or Install app, then confirm.</li></ol></section>
        <section><h3 className="font-bold">iPhone · Safari</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6"><li>Open examshuru.com in Safari.</li><li>Tap Share.</li><li>Choose Add to Home Screen, then tap Add.</li></ol></section>
      </div>
      <p className="mt-4 text-sm text-slate-600">Menu wording varies by browser. You can continue using the website if this option is unavailable.</p>
    </details>
  </section>;
}
