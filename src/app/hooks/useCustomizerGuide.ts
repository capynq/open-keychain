import { useCallback, useMemo, useState } from 'react';

export type GuideStepId = 'name' | 'shape' | 'export';

const STORAGE_KEY = 'open-keychain.customizer-guide';

const wasDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dismissed';
  } catch {
    return false;
  }
};

export const useCustomizerGuide = () => {
  const [visible, setVisible] = useState(() => !wasDismissed());
  const [nameEdited, setNameEdited] = useState(false);
  const [templateEdited, setTemplateEdited] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch {
      return;
    }
  }, []);

  const activeStep = useMemo<GuideStepId>(() => {
    if (!nameEdited) return 'name';
    if (!templateEdited) return 'shape';
    return 'export';
  }, [nameEdited, templateEdited]);

  return {
    visible,
    activeStep,
    dismiss,
    markNameEdited: () => setNameEdited(true),
    markTemplateEdited: () => setTemplateEdited(true),
  };
};

export type CustomizerGuideState = ReturnType<typeof useCustomizerGuide>;
