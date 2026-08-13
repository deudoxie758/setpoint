export default function ShareNotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-rose-400">404</p>
      <h1 className="text-xl font-semibold text-slate-100">This playlist link is no longer valid</h1>
      <p className="text-slate-400">The link may have expired or the playlist may have been deleted.</p>
    </div>
  );
}
