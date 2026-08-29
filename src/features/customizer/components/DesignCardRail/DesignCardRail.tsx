import type { ReactNode } from 'react';
import { useRef } from 'react';
import styles from './DesignCardRail.module.css';

export type DesignCardRailProps = { label: string; className?: string; children: ReactNode };

export const DesignCardRail = ({ label, className, children }: DesignCardRailProps) => {
  const railRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className={`${styles['design-card-rail-root-marker']} design-card-rail-shell`}
      data-scroll-state="top"
    >
      <div
        ref={railRef}
        className={`design-card-rail${className ? ` ${className}` : ''}`}
        aria-label={label}
        onScroll={(event) => {
          const rail = event.currentTarget;
          const atStart = rail.scrollLeft <= 1;
          const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
          rail.parentElement?.setAttribute(
            'data-scroll-state',
            atStart ? (atEnd ? 'none' : 'top') : atEnd ? 'bottom' : 'middle',
          );
        }}
      >
        {children}
      </div>
      <span className="sr-only" role="status">
        {label}
      </span>
    </div>
  );
};
