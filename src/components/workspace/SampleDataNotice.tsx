import { Info } from 'lucide-react';

/**
 * Says plainly that what's on screen is placeholder data, not the real thing.
 * Integrations fall back to sample content when they aren't connected, and
 * without this it's indistinguishable from a working connection.
 */
export default function SampleDataNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-200"
    >
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
