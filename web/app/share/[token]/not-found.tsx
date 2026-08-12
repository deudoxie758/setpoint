export default function ShareNotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-xl font-semibold">This playlist link is no longer valid</h1>
      <p className="text-slate-600">The link may have expired or the playlist may have been deleted.</p>
    </div>
  );
}
