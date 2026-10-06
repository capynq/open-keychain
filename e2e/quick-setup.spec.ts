import { expect, test, type Locator, type Page } from '@playwright/test';

import { encodeDesignDocument } from '../src/domain/keychain/design-document';
import { createDesignDocument } from '../src/domain/keychain/model/design-schema';
import { DEFAULT_PARAMS } from '../src/domain/keychain/model/types';
import { prepareForCapture, waitForReadyGeometry, watchBrowserErrors } from './helpers';

const setup = (page: Page) => page.getByTestId('quick-setup-dialog');
const next = (dialog: Locator) => dialog.getByRole('button', { name: 'Next', exact: true });
const advance = async (dialog: Locator) => {
  await next(dialog).click();
  for (let count = 0; count < 2; count += 1) {
    const keyringStep = dialog.getByRole('heading', {
      name: /Position|Opening/,
    });
    if (!(await keyringStep.isVisible().catch(() => false))) break;
    await next(dialog).click();
  }
};
const fontCategory = (dialog: Locator, name: string) =>
  dialog.getByRole('checkbox', { name, exact: true });
const checkFit = async (dialog: Locator) => {
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const footer = dialog.locator('footer');
  await expect(footer).toBeInViewport();
  // Navigation and headings must wrap between words, never into vertical letter stacks.
  const splitWords = await dialog
    .locator('footer button, h2, label span:not([class*="categorySpecimen"])')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const broken: string[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = node.textContent ?? '';
          for (const match of text.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            if (range.getClientRects().length > 1) broken.push(match[0]);
          }
        }
        return broken;
      }),
    );
  expect(splitWords).toEqual([]);
};

const expectPositionIllustration = async (scope: Locator) => {
  const diagram = scope.getByTestId('keyring-position-diagram');
  await expect(diagram).toBeVisible();
  await expect(diagram).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const sample = diagram.locator('img');
  await expect(sample).toHaveAttribute('src', '/showcase/keyring-position-alex.png');
  await expect(sample).toHaveAttribute('alt', '');
  await expect(sample).toHaveAttribute('draggable', 'false');
  await expect(sample).toHaveCSS('pointer-events', 'none');
  await expect(sample).toHaveCSS('mix-blend-mode', 'multiply');
  await expect(sample).toHaveCSS('user-select', 'none');
  await sample.evaluate((image) => (image as HTMLImageElement).decode());
  expect(await sample.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(778);
  expect(await sample.evaluate((image) => (image as HTMLImageElement).naturalHeight)).toBe(296);
  await expect(diagram.getByRole('radio')).toHaveCount(6);
  await expect(
    diagram.locator('label[data-position="right"]').locator('span[aria-hidden="true"]'),
  ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(diagram.getByRole('radio', { name: /ALEX/ })).toHaveCount(0);
  const markers = await diagram.locator('label[data-position]').evaluateAll((labels) =>
    labels.map((label) => {
      const { x, y } = label.getBoundingClientRect();
      return {
        position: label.getAttribute('data-position'),
        x,
        y,
        width: (label as HTMLElement).offsetWidth,
        height: (label as HTMLElement).offsetHeight,
      };
    }),
  );
  expect(markers).toHaveLength(6);
  expect(markers.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  const byPosition = Object.fromEntries(markers.map((marker) => [marker.position, marker]));
  expect(byPosition['top-left'].x).toBeLessThan(byPosition.top.x);
  expect(byPosition.top.x).toBeLessThan(byPosition['top-right'].x);
  expect(byPosition['top-left'].y).toBeLessThan(byPosition.left.y);
  expect(byPosition['top-right'].y).toBeLessThan(byPosition.right.y);
  expect(byPosition.bottom.y).toBeGreaterThan(byPosition.left.y);
  const expectedAnchors: Record<string, [number, number]> = {
    left: [0.1275, 0.7523],
    right: [0.89, 0.7523],
    top: [0.5983, 0.2838],
    bottom: [0.5983, 0.7568],
    'top-left': [0.1857, 0.3559],
    'top-right': [0.8736, 0.2793],
  };
  const diagramBounds = await diagram.boundingBox();
  expect(diagramBounds).not.toBeNull();
  for (const marker of markers) {
    const anchor = expectedAnchors[marker.position!];
    const relativeX = (marker.x + marker.width / 2 - diagramBounds!.x) / diagramBounds!.width;
    const relativeY = (marker.y + marker.height / 2 - diagramBounds!.y) / diagramBounds!.height;
    expect(Math.abs(relativeX - anchor[0])).toBeLessThan(0.015);
    expect(Math.abs(relativeY - anchor[1])).toBeLessThan(0.015);
  }
  for (let first = 0; first < markers.length; first += 1) {
    for (let second = first + 1; second < markers.length; second += 1) {
      const a = markers[first];
      const b = markers[second];
      const overlaps =
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps, `${a.position} and ${b.position} targets overlap`).toBe(false);
    }
  }
};

test('sidebar keyring choices show their shape, size, and direction controls', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem('open-keychain.analytics-consent', 'declined'),
  );
  await page.goto('/create');
  await waitForReadyGeometry(page);

  const keyring = page.getByTestId('keyring-settings');
  const opening = keyring.getByRole('radio', { name: /Standard round/ });
  const position = keyring.getByRole('radio', { name: 'Top', exact: true });
  const ovalSlot = keyring.getByRole('radio', { name: /Oval slot/ });
  await expect(keyring.getByRole('heading', { name: 'Keyring' })).toBeVisible();
  await expect(opening).toBeVisible();
  await expect(position).toBeVisible();
  await expectPositionIllustration(keyring);
  await expect(keyring.getByTestId('keyring-position-current')).toHaveText('Left');
  await expect(opening.locator('..')).toContainText('5 mm');
  const roundOpeningGlyphSizes = await Promise.all(
    ['Compact round', 'Standard round', 'Large round'].map((name) =>
      keyring
        .getByRole('radio', { name: new RegExp(name) })
        .locator('..')
        .locator('[class*="iconWell"] svg')
        .evaluate((icon) => Math.round(icon.getBoundingClientRect().width)),
    ),
  );
  expect(roundOpeningGlyphSizes).toEqual([14, 21, 30]);
  const ovalGlyph = await ovalSlot
    .locator('..')
    .locator('[class*="iconWell"] svg')
    .evaluate((icon) => {
      const shape = icon.querySelector('ellipse, path, circle') as SVGGraphicsElement | null;
      const bounds = shape?.getBBox();
      return {
        aspectRatio: bounds ? bounds.width / bounds.height : 0,
        transform: getComputedStyle(icon).transform,
      };
    });
  expect(ovalGlyph.aspectRatio).toBeGreaterThan(1.2);
  expect(ovalGlyph.transform).toBe('none');

  await expect(opening).toHaveCSS('width', '18px');
  await expect(opening).toHaveCSS('height', '18px');
  await expect(opening.locator('..')).toHaveCSS('display', 'grid');
  const splitWords = await keyring
    .locator('label span:not([aria-hidden="true"])')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const broken: string[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = node.textContent ?? '';
          for (const match of text.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            if (range.getClientRects().length > 1) broken.push(match[0]);
          }
        }
        return broken;
      }),
    );
  expect(splitWords).toEqual([]);
  await keyring.screenshot({ path: testInfo.outputPath('keyring-sidebar.png') });
  await position.check();
  await expect(position).toBeChecked();
  await expect(keyring.getByTestId('keyring-position-current')).toHaveText('Top');
  await expectPositionIllustration(keyring);
});

test('walks through six focused steps and applies accepted keyring, colors, and preferences', async ({
  page,
}, testInfo) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/create?setup=1');
  const dialog = setup(page);
  await expect
    .poll(() => dialog.evaluate((element) => element.clientWidth))
    .toBeLessThanOrEqual(600);
  await expect(dialog.getByRole('heading', { name: 'Name & size' })).toBeVisible();
  await expect(dialog.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(next(dialog)).toBeDisabled();
  await expect(fontCategory(dialog, 'Calligraphic')).toHaveCount(0);
  await expect(dialog.getByLabel('Base color', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Name or text').fill('ALEX');
  await dialog.getByLabel(/80 × 30/).check();
  await prepareForCapture(page);
  await dialog.screenshot({ path: testInfo.outputPath('step-1.png') });
  await checkFit(dialog);
  await next(dialog).click();
  await expect(dialog.getByRole('heading', { name: 'Position' })).toBeFocused();
  await expectPositionIllustration(dialog);
  for (const position of ['Left', 'Right', 'Bottom', 'Top', 'Top left', 'Top right']) {
    const choice = dialog.getByRole('radio', { name: position, exact: true });
    await choice.check();
    await expect(choice).toBeChecked();
    await expect(dialog.getByTestId('keyring-position-current')).toHaveText(position);
  }
  await dialog.screenshot({ path: testInfo.outputPath('step-keyring-position.png') });
  await checkFit(dialog);
  await next(dialog).click();
  await expect(dialog.getByRole('heading', { name: 'Opening' })).toBeFocused();
  const ovalSlot = dialog.getByRole('radio', { name: /Oval slot/ });
  await ovalSlot.check();
  await expect(ovalSlot).toBeChecked();
  const openingRadioSizes = await dialog
    .locator('fieldset[class*="picker"] input[type="radio"]')
    .evaluateAll((inputs) =>
      inputs.map((input) => {
        const rect = input.getBoundingClientRect();
        return [rect.width, rect.height];
      }),
    );
  expect(openingRadioSizes.length).toBe(4);
  expect(openingRadioSizes.every(([width, height]) => width === 18 && height === 18)).toBe(true);
  await dialog.screenshot({ path: testInfo.outputPath('step-keyring-opening.png') });
  await checkFit(dialog);
  await next(dialog).click();
  await expect(dialog.getByRole('heading', { name: 'Choose font styles' })).toBeFocused();
  const calligraphic = fontCategory(dialog, 'Calligraphic');
  const calligraphicCard = calligraphic.locator('..');
  const calligraphicSpecimen = calligraphicCard.locator('[class*="categorySpecimen"]');
  await expect(calligraphicSpecimen).toHaveText('Aa');
  await expect(calligraphicSpecimen).toHaveCSS('font-family', /OpenMarck/);
  await expect(calligraphicSpecimen).toHaveCSS('font-weight', '400');
  await calligraphicCard.click();
  await expect(calligraphic).toBeChecked();
  await expect
    .poll(() => calligraphicCard.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe('none');
  const fontChoiceLayout = await dialog
    .locator('label[class*="choiceCard"]')
    .evaluateAll((cards) => {
      const first = cards[0];
      return {
        display: first ? getComputedStyle(first.parentElement!).display : '',
        gap: first ? getComputedStyle(first.parentElement!).gap : '',
        widths: cards.map((card) => card.getBoundingClientRect().width),
      };
    });
  expect(fontChoiceLayout.display).toBe('flex');
  expect(fontChoiceLayout.gap).toContain('10px');
  expect(fontChoiceLayout.widths.every((width) => width >= 44)).toBe(true);
  expect(Math.max(...fontChoiceLayout.widths)).toBeGreaterThan(
    Math.min(...fontChoiceLayout.widths),
  );
  await calligraphic.focus();
  await expect(calligraphic).toHaveCSS('outline-style', 'none');
  await page.keyboard.press(' ');
  await expect
    .poll(() => calligraphicCard.evaluate((element) => getComputedStyle(element).outlineStyle))
    .toBe('solid');
  await calligraphic.check();
  await dialog.screenshot({ path: testInfo.outputPath('step-4.png') });
  await checkFit(dialog);
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: /Oval slot/ })).toBeChecked();
  await advance(dialog);
  await expect(fontCategory(dialog, 'Calligraphic')).toBeChecked();
  await advance(dialog);
  await dialog.getByLabel('Base color', { exact: true }).fill('#123456');
  await dialog.getByLabel('Text color', { exact: true }).fill('#fedcba');
  await dialog.screenshot({ path: testInfo.outputPath('step-5.png') });
  await checkFit(dialog);
  await advance(dialog);
  await expect(dialog.getByRole('heading', { name: 'Ready to create' })).toBeVisible();
  await expect(dialog).toContainText('Top right');
  await expect(dialog).toContainText('Calligraphic');
  await dialog.screenshot({ path: testInfo.outputPath('step-6.png') });
  await checkFit(dialog);
  await dialog.getByRole('button', { name: 'Edit name and size' }).click();
  await expect(dialog.getByLabel(/80 × 30/)).toBeChecked();
  await advance(dialog);
  await expect(dialog.getByRole('heading', { name: 'Ready to create' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(dialog).toBeHidden();
  await waitForReadyGeometry(page);
  await expect(page.getByLabel('Base color', { exact: true })).toHaveValue('#123456');
  await expect(page.getByLabel('Text color', { exact: true })).toHaveValue('#fedcba');
  const appearance = page.getByTestId('sidebar-colors');
  await expect(appearance).toHaveCount(1);
  await expect(page.getByRole('button', { name: /reset colors/i })).toHaveCount(0);
  await expect(appearance.locator('[data-testid="sidebar-color-field"]')).toHaveCount(2);
  await expect(appearance.locator('input[type="color"]')).toHaveCount(2);
  await expect(appearance.locator('input[type="color"]').first()).toHaveCSS('width', '44px');
  await expect(appearance.locator('input[type="color"]').first()).toHaveCSS('height', '44px');
  await expect(appearance.locator('code').first()).toHaveText('#123456');
  await expect(appearance.locator('code').nth(1)).toHaveText('#FEDCBA');
  await expect(page.locator('.font-group')).toHaveCount(1);
  await expect(page.locator('.font-group').getByRole('heading')).toHaveText('Calligraphic');
  await expect(page.getByTestId('template-card-name-keychain')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Top right' })).toBeChecked();
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  await expect(dialog.getByLabel(/80 × 30/)).toBeChecked();
  await dialog.getByLabel('Custom size', { exact: true }).check();
  await dialog.getByLabel('Width', { exact: true }).fill('10');
  await dialog.getByLabel('Height', { exact: true }).fill('20');
  await expect(next(dialog)).toBeDisabled();
  await expect(dialog.getByRole('alert')).toContainText('20 to 120');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open quick setup' })).toBeFocused();
  // Applying only appearance/preferences must also succeed when geometry is unchanged.
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  await advance(dialog);
  await fontCategory(dialog, 'Calligraphic').uncheck();
  await advance(dialog);
  await dialog.getByLabel('Base color', { exact: true }).fill('#334455');
  await advance(dialog);
  await dialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Base color', { exact: true })).toHaveValue('#334455');
  await expect(page.locator('.font-group')).toHaveCount(10);
  assertNoBrowserErrors();
});

test('keeps both diagonal position labels in setup review', async ({ page }) => {
  const selectPositionAndReview = async (label: 'Top left' | 'Top right') => {
    const dialog = setup(page);
    await dialog.getByLabel('Name or text').fill('ALEX');
    await dialog.getByLabel(/80 × 30/).check();
    await next(dialog).click();

    const position = dialog.getByRole('radio', { name: label, exact: true });
    await position.check();
    await expectPositionIllustration(dialog);
    await next(dialog).click();
    await next(dialog).click();
    await next(dialog).click();
    await next(dialog).click();

    await expect(dialog.getByRole('heading', { name: 'Ready to create' })).toBeVisible();
    await expect(dialog).toContainText(label);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  };

  await page.goto('/create?setup=1');
  await selectPositionAndReview('Top left');
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  await selectPositionAndReview('Top right');
});

test('restores legacy backing and text finishes from a shared design', async ({ page }) => {
  const legacy =
    'v7.' +
    Buffer.from(
      JSON.stringify({ finish: { ef: 'round', et: 0.6, es: 'chamfer', er: 0.2 } }),
    ).toString('base64url');
  await page.goto(`/create?design=${legacy}`);
  await waitForReadyGeometry(page);
  const finishSettings = page.getByTestId('geometry-finish-settings');
  await expect(
    finishSettings
      .getByRole('radiogroup', { name: 'Backing profile', exact: true })
      .getByRole('radio', { name: 'Rounded', exact: true }),
  ).toBeChecked();
  await expect(
    finishSettings
      .getByRole('radiogroup', { name: 'Text profile', exact: true })
      .getByRole('radio', { name: 'Chamfered', exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('Backing top edge')).toHaveValue('0.6');
  await expect(page.getByLabel('Backing bottom edge')).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'Edge amount', exact: true })).toHaveValue('0.2');
});

test('discards closed drafts and keeps keyboard focus inside the modal', async ({ page }) => {
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  const dialog = setup(page);
  await dialog.getByLabel('Name or text').fill('UNSAVED');
  await dialog.getByLabel(/80 × 30/).check();
  await advance(dialog);
  await fontCategory(dialog, 'Marker').check();
  await advance(dialog);
  await dialog.getByLabel('Base color', { exact: true }).fill('#123456');
  await advance(dialog);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[data-testid="quick-setup-dialog"]')),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Name or text')).toHaveValue('ALEX');
  await expect(page.getByLabel('Base color', { exact: true })).not.toHaveValue('#123456');
  expect(
    await page.evaluate(() => localStorage.getItem('open-keychain.favorite-font-categories')),
  ).toBeNull();
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  await expect(dialog.getByLabel('Name or text')).toHaveValue('ALEX');
  await expect(dialog.locator('input[type="radio"]:checked')).toHaveCount(0);
});

test('keeps rejected setup drafts without committing colors or font preferences', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      override postMessage(message: unknown, transfer: Transferable[]): void;
      override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
      override postMessage(
        message: unknown,
        transferOrOptions?: Transferable[] | StructuredSerializeOptions,
      ): void {
        const request = message as {
          type?: string;
          requestId?: number;
          params?: { text?: string };
        };
        if (request.type === 'validate' && request.params?.text === 'REJECT') {
          queueMicrotask(() =>
            this.dispatchEvent(
              new MessageEvent('message', {
                data: {
                  type: 'error',
                  requestId: request.requestId,
                  message: 'Injected setup rejection.',
                },
              }),
            ),
          );
          return;
        }
        if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
        else super.postMessage(message, transferOrOptions);
      }
    };
  });
  await page.goto('/create?setup=1');
  const dialog = setup(page);
  await dialog.getByLabel('Name or text').fill('REJECT');
  await dialog.getByLabel(/80 × 30/).check();
  await advance(dialog);
  await fontCategory(dialog, 'Marker').check();
  await advance(dialog);
  await dialog.getByLabel('Base color', { exact: true }).fill('#123456');
  await advance(dialog);
  await dialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Try a larger size');
  expect(
    await page.evaluate(() => localStorage.getItem('open-keychain.favorite-font-categories')),
  ).toBeNull();
  await dialog.getByRole('button', { name: 'Edit name and size' }).click();
  await expect(dialog.getByLabel('Name or text')).toHaveValue('REJECT');
  await dialog.getByLabel('Name or text').fill('ALEX');
  await advance(dialog);
  await dialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Base color', { exact: true })).toHaveValue('#123456');
  await expect(page.locator('.font-group')).toHaveCount(1);
});

for (const locale of ['en', 'ru', 'uk']) {
  test(`fits each localized step at 320 px with enlarged text: ${locale}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/create?setup=1&lang=${locale}`);
    const dialog = setup(page);
    await expect(dialog).toBeVisible();
    await page.addStyleTag({ content: ':root { font-size: 200%; }' });
    const primary = dialog.locator('footer button').last();
    await dialog.locator('input[type="radio"]').nth(2).check();
    for (let step = 1; step <= 6; step++) {
      if (step === 2) {
        await expectPositionIllustration(dialog);
        const labels =
          locale === 'en'
            ? ['Top left', 'Top right']
            : locale === 'ru'
              ? ['Сверху слева', 'Сверху справа']
              : ['Зверху ліворуч', 'Зверху праворуч'];
        for (const label of labels) {
          const position = dialog.getByRole('radio', { name: label, exact: true });
          await expect(position).toBeVisible();
          await position.check();
          await expect(position).toBeChecked();
          await expect(dialog.getByTestId('keyring-position-current')).toHaveText(label);
        }
      }
      await checkFit(dialog);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await dialog.screenshot({ path: testInfo.outputPath(`320-${locale}-step-${step}.png`) });
      if (step < 6) await primary.click();
    }
  });
}

test('direct and shared Customizer entry stays free of an automatic setup dialog', async ({
  page,
}) => {
  await page.goto('/create');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(setup(page)).toHaveCount(0);
  const design = encodeDesignDocument(
    createDesignDocument({
      ...DEFAULT_PARAMS,
      text: 'MIRA',
      sizeEnvelope: { widthMm: 60, heightMm: 25 },
      textEdgeFinish: 'round',
      textEdgeMm: 0.2,
    }),
  );
  await page.goto(`/create?setup=1&design=${design}`);
  await waitForReadyGeometry(page);
  await expect(setup(page)).toHaveCount(0);
  await expect(page.getByLabel('Name or text')).toHaveValue('MIRA');
  await expect(page.getByLabel('Edge amount')).toHaveValue('0.2');
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  await setup(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('design')).toBe(design);
  await expect(page.getByLabel('Name or text')).toHaveValue('MIRA');
});

test('keeps actions reachable with a keyboard-sized viewport', async ({ page }) => {
  await page.goto('/create?setup=1');
  const dialog = setup(page);
  await dialog.getByLabel('Name or text').focus();
  await page.setViewportSize({ width: 390, height: 420 });
  await dialog.getByLabel('Custom size', { exact: true }).check();
  await dialog.getByLabel('Width', { exact: true }).fill('80');
  await dialog.getByLabel('Height', { exact: true }).fill('30');
  await checkFit(dialog);
  await expect(next(dialog)).toBeEnabled();
  await advance(dialog);
  await expect(dialog.getByRole('heading', { name: 'Choose font styles' })).toBeFocused();
  await checkFit(dialog);
});

test('keeps sidebar colors balanced at narrow enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  const sidebar = page.getByTestId('sidebar-colors');
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  const fields = sidebar.getByTestId('sidebar-color-field');
  await expect(fields).toHaveCount(2);
  for (const field of await fields.all()) {
    expect(await field.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const swatch = field.locator('input[type="color"]');
    expect(
      await swatch.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
      }),
    ).toEqual(['4px', '4px', '4px', '4px']);
  }
});

test('keeps setup, export and share together in the header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const actions = page.locator('.topbar-export-actions');
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await waitForReadyGeometry(page);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  const buttons = actions.locator('button');
  await expect(buttons).toHaveCount(3);
  const bounds = await Promise.all((await buttons.all()).map((button) => button.boundingBox()));
  expect(bounds.every((bound) => bound && Math.abs(bound.y - bounds[0]!.y) < 1)).toBe(true);
  expect(
    await page.locator('.topbar').evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await actions.getByRole('button', { name: 'Open quick setup' }).click();
  await expect(setup(page)).toBeVisible();
});

test('setup preserves a preselected articulated template', async ({ page }) => {
  await page.goto('/create?setup=1&template=articulated-name');
  const dialog = setup(page);
  await dialog.getByLabel(/120 × 40/).check();
  await advance(dialog);
  await advance(dialog);
  await advance(dialog);
  await dialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(dialog).toBeHidden();
  await waitForReadyGeometry(page);
  await expect(page.getByTestId('template-card-articulated-name')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(new URL(page.url()).searchParams.get('template')).toBe('articulated-name');
});

test('shows accepted dimensions and selected maximum consistently', async ({ page }) => {
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await page.getByRole('button', { name: 'Open quick setup' }).click();
  const initialDialog = setup(page);
  await initialDialog.getByLabel('Name or text').fill('MIRA');
  await initialDialog.getByLabel(/80 × 30/).check();
  await advance(initialDialog);
  await advance(initialDialog);
  await advance(initialDialog);
  await initialDialog.getByRole('button', { name: 'Start designing' }).click();
  await expect(initialDialog).toBeHidden();
  await waitForReadyGeometry(page);

  const summary = page.locator('.preview-summary');
  await expect(summary).toContainText('Fits within maximum');
  const actualSize = await summary
    .locator('.summary-metrics')
    .locator('strong')
    .first()
    .textContent();
  expect(actualSize).toMatch(/mm/);

  await page.getByRole('button', { name: 'Open quick setup' }).click();
  const dialog = setup(page);
  await advance(dialog);
  await advance(dialog);
  await advance(dialog);
  await expect(dialog).toContainText('Last accepted result');
  await expect(dialog).toContainText(actualSize!.trim());
  await dialog.getByRole('button', { name: 'Edit name and size' }).click();
  await dialog.getByLabel('Name or text').fill('DRAFT');
  await advance(dialog);
  await expect(dialog).not.toContainText('Last accepted result');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: /export/i }).click();
  const preflight = page.locator('.export-preflight');
  await preflight.locator('summary').click();
  await expect(preflight).toContainText('Fits within maximum');
  await expect(preflight).toContainText('80.0 × 30.0 mm');
  await expect(preflight).toContainText(actualSize!.trim());
});

test('keeps actual and maximum metrics readable at narrow enlarged text', async ({ page }) => {
  const design = encodeDesignDocument(
    createDesignDocument({ ...DEFAULT_PARAMS, sizeEnvelope: { widthMm: 80, heightMm: 30 } }),
  );
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto(`/create?design=${design}&lang=ru`);
  await expect(page.locator('.preview-panel')).toHaveAttribute('data-model-ready', 'true');
  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  const summary = page.locator('.preview-summary');
  await expect(summary.locator('.summary-fit-status')).toContainText('80.0 × 30.0 mm');
  expect(await summary.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  for (const metric of await summary.locator('.summary-metrics strong').all()) {
    expect(await metric.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
  }
});
