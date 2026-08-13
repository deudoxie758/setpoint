"use client";

export default function ShareError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-rose-400">Error</p>
      <h1 className="text-xl font-semibold text-slate-100">This playlist couldn't be loaded</h1>
      <p className="text-slate-400">Something went wrong on our end. Please try again in a moment.</p>
      <button type="button" onClick={reset} className="btn-ghost mt-2">
        Try again
      </button>
    </div>
  );
}
