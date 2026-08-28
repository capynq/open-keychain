import { expect, test } from '@playwright/test';

type ContrastAudit = {
  selector: string;
  foreground: string;
  background: string;
  ratio: number;
};

const landingTextSelectors = [
  '.landing-kicker',
  '.landing-lede',
  '.landing-section-description',
  '.landing-step-card p',
  '.landing-template-card p',
  '.landing-run-card > p',
  '.landing-run-card > span',
  '.landing-run-card ul',
  '.landing-card-link',
  '.landing-footer',
  '.landing-footer a',
  '[data-showcase-control="previous"]',
  '[data-showcase-control="next"]',
  '[data-showcase-control="slide-1"]',
  '.landing-trust .landing-kicker',
  '.landing-trust h2',
  '.landing-trust p',
  '.analytics-consent h2',
  '.analytics-consent p',
  '.analytics-consent p a',
  '.analytics-consent-decline',
  '.analytics-consent-accept',
  '.language-picker-trigger',
  '.icon-button',
] as const;

const focusSelectors = [
  '.landing-button-primary',
  '.landing-header-cta',
  '.landing-nav a',
  '.landing-card-link',
  '.landing-footer a',
  '.analytics-consent-decline',
  '.analytics-consent-accept',
] as const;

test('keeps landing and consent text at WCAG AA contrast', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.analytics-consent')).toBeVisible();

  const audit = await page.evaluate((selectors) => {
    const parseColor = (value: string): [number, number, number] | undefined => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return undefined;
      const channels = match[1].split(',').map((channel) => Number.parseFloat(channel.trim()));
      if (channels.length < 3 || channels.slice(0, 3).some((channel) => Number.isNaN(channel))) {
        return undefined;
      }
      return channels.slice(0, 3) as [number, number, number];
    };
    const luminance = (color: [number, number, number]): number => {
      const channels = color
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        );
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (foreground: string, background: string): number => {
      const foregroundColor = parseColor(foreground);
      const backgroundColor = parseColor(background);
      if (!foregroundColor || !backgroundColor) return 0;
      const light = luminance(foregroundColor);
      const dark = luminance(backgroundColor);
      return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    };
    const backgroundFor = (element: Element): string => {
      for (let current: Element | null = element; current; current = current.parentElement) {
        const background = getComputedStyle(current).backgroundColor;
        const color = parseColor(background);
        if (color && !background.endsWith(', 0)') && !background.endsWith(',0)')) return background;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };

    return selectors.flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const styles = getComputedStyle(element);
      const background = backgroundFor(element);
      return [
        { selector, foreground: styles.color, background, ratio: ratio(styles.color, background) },
      ];
    });
  }, landingTextSelectors);

  for (const entry of audit as ContrastAudit[]) {
    expect(
      entry.ratio,
      `${entry.selector}: ${entry.foreground} on ${entry.background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('keeps landing focus indicators visible against their surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.analytics-consent')).toBeVisible();

  const indicators = await page.evaluate((selectors) => {
    const parseColor = (value: string): [number, number, number] | undefined => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return undefined;
      const channels = match[1].split(',').map((channel) => Number.parseFloat(channel.trim()));
      return channels.length >= 3 ? (channels.slice(0, 3) as [number, number, number]) : undefined;
    };
    const luminance = (color: [number, number, number]): number =>
      color
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (foreground: string, background: string): number => {
      const foregroundColor = parseColor(foreground);
      const backgroundColor = parseColor(background);
      if (!foregroundColor || !backgroundColor) return 0;
      const foregroundLuminance = luminance(foregroundColor);
      const backgroundLuminance = luminance(backgroundColor);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };
    const backgroundFor = (element: Element): string => {
      for (let current: Element | null = element; current; current = current.parentElement) {
        const background = getComputedStyle(current).backgroundColor;
        if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') return background;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };
    return selectors.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return [];
      element.focus();
      const styles = getComputedStyle(element);
      const background = backgroundFor(element);
      return [
        {
          selector,
          outline: styles.outlineColor,
          style: styles.outlineStyle,
          boxShadow: styles.boxShadow,
          ratio: contrast(styles.outlineColor, background),
        },
      ];
    });
  }, focusSelectors);

  for (const indicator of indicators) {
    expect(
      indicator.style !== 'none' || indicator.boxShadow !== 'none',
      `${indicator.selector} should expose a focus indicator`,
    ).toBe(true);
    if (indicator.style !== 'none')
      expect(indicator.ratio, `${indicator.selector} focus outline`).toBeGreaterThanOrEqual(3);
  }
});

test('keeps icon action hover states visually distinct and contrasting', async ({ page }) => {
  await page.goto('/create');
  const actions = page.locator(
    '.export-header-button, .share-header-button, .randomize-header-button, .language-picker-trigger',
  );

  for (const action of await actions.all()) {
    const before = await action.evaluate((element) => {
      const styles = getComputedStyle(element);
      return { background: styles.backgroundColor, foreground: styles.color };
    });
    await action.hover();
    const after = await action.evaluate((element) => {
      const parse = (value: string): [number, number, number] => {
        const channels = value.match(/rgba?\(([^)]+)\)/)?.[1].split(',') ?? [];
        return channels.slice(0, 3).map((channel) => Number.parseFloat(channel.trim())) as [
          number,
          number,
          number,
        ];
      };
      const luminance = (value: [number, number, number]): number =>
        value
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
          )
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const styles = getComputedStyle(element);
      const background = luminance(parse(styles.backgroundColor));
      const foreground = luminance(parse(styles.color));
      return {
        background: styles.backgroundColor,
        foreground: styles.color,
        ratio:
          (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05),
      };
    });
    expect(after.background !== before.background || after.foreground !== before.foreground).toBe(
      true,
    );
    expect(after.ratio).toBeGreaterThanOrEqual(3);
  }
});
