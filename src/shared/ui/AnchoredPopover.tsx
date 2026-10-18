import type { ComponentPropsWithRef, ReactElement, ReactNode } from 'react';

import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';

import { usePopoverMotion } from '../lib/usePopoverMotion';
import styles from './AnchoredPopover.module.css';

export type AnchoredPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  placement?: 'top-end' | 'bottom-end';
  sizing?: 'fixed' | 'content';
  trigger: (props: ComponentPropsWithRef<'button'>) => ReactElement;
  children: ReactNode;
};

/** A non-modal, portaled control surface; feature owners retain action and async state. */
export const AnchoredPopover = ({
  open,
  onOpenChange,
  label,
  placement = 'bottom-end',
  sizing = 'fixed',
  trigger,
  children,
}: AnchoredPopoverProps) => {
  const {
    refs: { setReference, setFloating },
    floatingStyles,
    context,
  } = useFloating({
    open,
    onOpenChange,
    placement,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.setProperty(
            '--popover-available-height',
            `${Math.max(0, availableHeight)}px`,
          );
        },
      }),
    ],
  });
  const motion = usePopoverMotion();
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: motion.duration,
    initial: {
      opacity: motion.enabled ? 0 : 1,
      transform: motion.enabled ? 'scale(0.95)' : 'scale(1)',
    },
    open: { opacity: 1, transform: 'scale(1)' },
    close: { opacity: 0, transform: motion.enabled ? 'scale(0.95)' : 'scale(1)' },
    common: ({ side }) => ({
      transformOrigin: side === 'top' ? 'bottom right' : 'top right',
      transitionTimingFunction: 'var(--workshop-ease)',
    }),
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      {trigger({ ...getReferenceProps(), ref: setReference })}
      {isMounted && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} restoreFocus disabled={!open}>
            <div
              {...getFloatingProps()}
              ref={setFloating}
              className={styles.positioner}
              style={floatingStyles}
              aria-label={label}
              aria-hidden={!open || undefined}
              inert={!open}
              data-sizing={sizing}
              data-state={open ? 'open' : 'closed'}
              data-motion={motion.enabled ? 'animated' : 'instant'}
              data-anchored-popover="true"
            >
              <div className={styles.root} style={transitionStyles}>
                {children}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};
