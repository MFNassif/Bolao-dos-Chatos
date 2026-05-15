export default function TeamBadge({ name, code, flag, align = 'left', size = 'md' }) {
  const initials = (code || name || '?').toString().slice(0, 3).toUpperCase();
  const imgSize = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10';
  return (
    <div className={`flex items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''} min-w-0`}>
      <div className={`shrink-0 ${imgSize} rounded-lg bg-white/8 overflow-hidden border border-white/10 flex items-center justify-center`}>
        {flag
          ? <img src={flag} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <span className="text-[10px] font-display text-slate">{initials}</span>
        }
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white truncate leading-tight">{name}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate">{code || initials}</p>
      </div>
    </div>
  );
}
