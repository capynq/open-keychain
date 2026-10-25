import { useEffect, useState } from 'react';

import type { FontTarget } from '../model/font-browser';
import type { useCustomizerParams } from './useCustomizerParams';

export const useFontChooser = (customizer: ReturnType<typeof useCustomizerParams>) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ fontId: string; target: FontTarget }>();
  const { acceptedParams, candidateFeedback } = customizer;
  const busy = Boolean(pending && candidateFeedback?.status === 'checking');

  useEffect(() => {
    if (!pending || candidateFeedback?.status === 'checking') return;
    if (candidateFeedback?.status === 'rejected' || candidateFeedback?.status === 'failed') return;
    // Retain a rejected font intent so a validated repair can still complete this choice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(undefined);
    const acceptedId =
      pending.target === 'secondary' ? acceptedParams.subtitleFontId : acceptedParams.fontId;
    if (acceptedId === pending.fontId) setOpen(false);
  }, [acceptedParams, candidateFeedback, pending]);

  return {
    open,
    busy,
    show: () => {
      setPending(undefined);
      setOpen(true);
    },
    close: () => {
      if (!busy) {
        customizer.cancelRecovery();
        setPending(undefined);
        setOpen(false);
      }
    },
    proposed: (fontId: string, target: FontTarget) => setPending({ fontId, target }),
  };
};
