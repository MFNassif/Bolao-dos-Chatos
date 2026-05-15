export default function Loading({ fullscreen = false, label = 'Carregando...' }) {
  const base = (
    <div className="flex flex-col items-center gap-3 text-slate">
      <div className="w-10 h-10 rounded-full border-4 border-white/10 border-t-green animate-spin" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
  if (!fullscreen) return <div className="py-16 flex justify-center">{base}</div>;
  return <div className="min-h-screen w-full flex items-center justify-center">{base}</div>;
}
