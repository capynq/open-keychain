import type { ReactNode } from 'react';
import '../SeoPage.css';
import '../../../shared/styles/seo-links.css';

export const SeoShell = ({ children }: { children: ReactNode }) => (
  <div className="landing-shell seo-shell">{children}</div>
);
