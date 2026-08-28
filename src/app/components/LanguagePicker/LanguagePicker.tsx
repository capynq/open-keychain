import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';
import styles from './LanguagePicker.module.css';

const LOCALE_OPTIONS: readonly { value: Locale; flag: string; labelKey: string }[] = [
  { value: 'en', flag: '🇬🇧', labelKey: 'languageEnglish' },
  { value: 'ru', flag: '🇷🇺', labelKey: 'languageRussian' },
  { value: 'uk', flag: '🇺🇦', labelKey: 'languageUkrainian' },
];

export const LanguagePicker = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const currentIndex = LOCALE_OPTIONS.findIndex((option) => option.value === locale);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(currentIndex, 0));

  useEffect(() => {
    if (!open) return undefined;
    optionRefs.current[activeIndex]?.focus();
    return undefined;
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  const closeMenu = (restoreFocus = true): void => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  const selectLocale = (nextLocale: Locale): void => {
    onLocaleChange(nextLocale);
    closeMenu();
  };

  const moveActive = (direction: number): void => {
    setActiveIndex(
      (current) => (current + direction + LOCALE_OPTIONS.length) % LOCALE_OPTIONS.length,
    );
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex(Math.max(currentIndex, 0));
    setOpen(true);
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : LOCALE_OPTIONS.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectLocale(LOCALE_OPTIONS[activeIndex].value);
    }
  };

  const currentOption = LOCALE_OPTIONS[Math.max(currentIndex, 0)];

  return (
    <div className={`${styles.root} language-picker`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button language-picker-trigger"
        aria-label={`${t(locale, 'language')}: ${t(locale, currentOption.labelKey)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="language-menu"
        data-icon-button="true"
        data-icon-action="language"
        data-tooltip={t(locale, 'language')}
        title={t(locale, 'language')}
        onClick={() => {
          setActiveIndex(Math.max(currentIndex, 0));
          setOpen((current) => !current);
        }}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="language-picker-flag" aria-hidden="true">
          {currentOption.flag}
        </span>
        <span className="language-picker-code" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <ChevronDown aria-hidden="true" focusable="false" size={15} strokeWidth={2} />
      </button>
      {open && (
        <div
          id="language-menu"
          className="language-picker-menu"
          role="listbox"
          aria-label={t(locale, 'language')}
          onKeyDown={handleOptionKeyDown}
        >
          {LOCALE_OPTIONS.map((option, index) => {
            const selected = option.value === locale;

            return (
              <div
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                key={option.value}
                id={`language-option-${option.value}`}
                data-language-option={option.value}
                className={`language-picker-option${selected ? ' selected' : ''}`}
                role="option"
                aria-selected={selected}
                tabIndex={0}
                onClick={() => selectLocale(option.value)}
              >
                <span className="language-picker-option-flag" aria-hidden="true">
                  {option.flag}
                </span>
                <span>{t(locale, option.labelKey)}</span>
                {selected && (
                  <Check aria-hidden="true" focusable="false" size={16} strokeWidth={2.2} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
