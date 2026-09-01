import type { ReactNode } from 'react';

import './InfoBlock.module.css';

export const InfoBlock = ({
  title,
  children,
  tone = 'note',
  details = false,
  summary,
}: {
  title: string;
  children: ReactNode;
  tone?: 'note' | 'tip' | 'warning' | 'hardware' | 'instruction';
  details?: boolean;
  summary?: string;
}) =>
  details ? (
    <details className={`info-block info-block--${tone}`}>
      <summary>{summary ?? title}</summary>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </details>
  ) : (
    <aside className={`info-block info-block--${tone}`} aria-label={title}>
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  );
