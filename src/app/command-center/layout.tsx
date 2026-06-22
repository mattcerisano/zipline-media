import ThemeProvider from '@/components/workspace/ThemeProvider';

/**
 * Scopes Studio OS theming to the Command Center route. The public marketing
 * pages stay locked to the dark brand look — only this subtree responds to the
 * user's light / dim / dark preference.
 */
export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
