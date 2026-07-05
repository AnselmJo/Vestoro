import { de } from '../i18n/de';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="card p-10 max-w-md text-center">
        <div className="text-3xl mb-3" style={{ color: 'var(--accent)' }}>◷</div>
        <h2 className="font-semibold text-lg mb-2">{title} — {de.comingSoon.title}</h2>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{de.comingSoon.body}</p>
      </div>
    </div>
  );
}
