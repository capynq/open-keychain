import { expect, test } from '@playwright/test';

import { selectLocale } from './helpers';
const cameraViews = [
  'Home view',
  'Front view',
  'Back view',
  'Left view',
  'Right view',
  'Top view',
  'Bottom view',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('open-keychain.analytics-consent', 'declined');
  });
});

test('keeps semantic icon actions still when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/create');

  for (const motion of ['nudge', 'rotate'] as const) {
    const button = page.locator(`[data-icon-motion="${motion}"]:not(:disabled)`).first();
    await expect(button).toBeVisible();
    await button.hover();
    await expect(button.locator('svg')).toHaveCSS('transform', 'none');
  }
});

for (const flow of [
  {
    locale: 'EN',
    name: 'OLIVER',
    nameInput: 'Name or text',
    template: 'Nameplate',
    camera: 'Top view',
    exportButton: 'Export',
    dialog: 'Choose an export',
    format: /STL file/,
    filename: /^keychain-oliver-contour\.stl$/,
  },
  {
    locale: 'RU',
    name: 'НИКИТА',
    nameInput: 'Имя или текст',
    template: 'Именная табличка',
    camera: 'Сверху',
    exportButton: 'Экспорт',
    dialog: 'Выберите экспорт',
    format: /3MF · единый объект/,
    filename: /^keychain-name-contour\.3mf$/,
  },
] as const) {
  test(`supports the ${flow.locale} localized keyboard workflow and downloads ${flow.locale === 'EN' ? 'STL' : '3MF'}`, async ({
    page,
  }) => {
    await page.goto('/create');

    if (flow.locale === 'RU') {
      await selectLocale(page, 'ru');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    }

    const name = page.getByLabel(flow.nameInput);
    await name.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(flow.name);
    await expect(name).toHaveValue(flow.name);

    const template = page.getByRole('button', { name: flow.template });
    await template.focus();
    await page.keyboard.press('Enter');
    await expect(template).toHaveClass(/selected/);
    await expect(page.locator('.status-pill')).toHaveText(/Ready|Готово/, { timeout: 10000 });

    const camera = page.getByRole('button', { name: flow.camera });
    await camera.focus();
    await page.keyboard.press('Enter');
    await expect(camera).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.viewer')).toHaveAttribute('data-view', 'top');

    const exportTrigger = page.locator('.export-header-button');
    await expect(exportTrigger).toBeVisible();
    await exportTrigger.focus();
    await exportTrigger.press('Enter');
    if ((await exportTrigger.getAttribute('aria-expanded')) !== 'true')
      await exportTrigger.press('Space');
    const dialog = page.getByRole('dialog', { name: flow.dialog });
    await expect(dialog).toBeVisible();
    const backdrop = page.locator('.modal-backdrop');
    await expect(backdrop).toBeVisible();
    const modalLayout = await backdrop.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        position: style.position,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(modalLayout.position).toBe('fixed');
    expect(modalLayout.top).toBe(0);
    expect(modalLayout.left).toBe(0);
    expect(modalLayout.width).toBe(modalLayout.viewportWidth);
    expect(modalLayout.height).toBe(modalLayout.viewportHeight);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await exportTrigger.focus();
    await exportTrigger.press('Enter');
    if ((await exportTrigger.getAttribute('aria-expanded')) !== 'true')
      await exportTrigger.press('Space');
    await expect(dialog).toBeVisible();
    const formatButton = dialog.getByRole('button', { name: flow.format });
    await expect(formatButton).toBeEnabled();
    const download = page.waitForEvent('download');
    await formatButton.focus();
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(flow.filename);
    await expect(dialog).toContainText(/Download ready|Загрузка готова/);
    await dialog.locator('.modal-close').click();
    await expect(dialog).toBeHidden();
  });
}

test('customizes a name, uses every icon camera preset, and downloads STL', async ({ page }) => {
  await page.goto('/create');
  await expect(page.getByRole('link', { name: 'Open Keychain' })).toBeVisible();
  await expect(page.locator('.brand-mark small')).toHaveCount(0);
  await expect(page.locator('.preview-heading h2')).toHaveText('Live preview');
  await expect(page.getByRole('heading', { name: 'ALEX' })).toHaveCount(0);
  const name = page.getByLabel('Name or text');
  await name.fill('OLIVER');
  await page.getByRole('button', { name: 'Capsule' }).click();
  await expect(page.locator('.status-pill:visible').first()).toHaveText(/Ready/, {
    timeout: 10000,
  });
  const viewer = page.locator('.viewer');
  for (const label of cameraViews) {
    const button = page.getByRole('button', { name: label });
    await expect(button.locator('svg[data-icon]')).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(viewer).toHaveAttribute('data-view', 'bottom');
  const surface = page.locator('.viewer-surface');
  await surface.scrollIntoViewIfNeeded();
  const surfaceBox = await surface.boundingBox();
  expect(surfaceBox).toBeTruthy();
  await page.mouse.move(
    surfaceBox!.x + surfaceBox!.width * 0.5,
    surfaceBox!.y + surfaceBox!.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    surfaceBox!.x + surfaceBox!.width * 0.18,
    surfaceBox!.y + surfaceBox!.height * 0.38,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await expect(viewer).toHaveAttribute('data-view', 'custom');
  await expect(surface.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /STL file/ })
    .click();
  expect((await download).suggestedFilename()).toMatch(/^keychain-oliver-capsule\.stl$/);
});

test('keeps shared icon glyphs centered while showing tactile hover feedback', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  const buttons = [
    page.getByRole('button', { name: 'Export' }),
    page.getByRole('button', { name: 'Share' }),
    page.getByRole('button', { name: 'Randomize' }),
  ];

  for (const button of buttons) {
    await button.hover();
    const metrics = await button.evaluate((element) => {
      const icon = element.querySelector('svg');
      if (!icon) return undefined;
      const buttonRect = element.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        transform: getComputedStyle(icon).transform,
        centerOffsetX:
          iconRect.left + iconRect.width / 2 - (buttonRect.left + buttonRect.width / 2),
        centerOffsetY:
          iconRect.top + iconRect.height / 2 - (buttonRect.top + buttonRect.height / 2),
        shadow: getComputedStyle(element).boxShadow,
      };
    });
    expect(metrics).toBeDefined();
    expect(metrics?.transform).not.toContain('translate');
    expect(Math.abs(metrics?.centerOffsetX ?? 99)).toBeLessThan(1);
    expect(Math.abs(metrics?.centerOffsetY ?? 99)).toBeLessThan(1);
    expect(metrics?.shadow).not.toBe('none');
  }
});

test('treats adjusted NIKITA Bubble geometry as ready and keeps width warnings exportable', async ({
  page,
}) => {
  await page.goto('/create');
  await page.getByLabel('Name or text').fill('NIKITA');
  await page.getByRole('button', { name: 'Bubble' }).click();
  await page.getByRole('button', { name: /Bungee/ }).click();
  await expect(page.locator('.status-pill')).toHaveText('Ready · adjusted', { timeout: 10000 });
  await expect(page.getByText(/adjusted to .* mm high/)).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
  await page.getByLabel('Text size').fill('12');
  await page.getByLabel('Name or text').fill('WWWWWWWWWWWWWWWWWWWWWWWW');
  await expect(page.locator('.status-pill')).toHaveText('Ready · adjusted', { timeout: 10000 });
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Close' }).click();
});
test('switches to a bilingual font when Cyrillic text is entered', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /Bungee/ }).click();
  await page.getByLabel('Name or text').fill('НИКИТА');
  await expect(page.getByRole('button', { name: /Bungee/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Rubik Black/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Caveat/ })).toBeVisible();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
});
test('selects a printable heavy font for articulated names and hides unsuitable choices', async ({
  page,
}) => {
  await page.goto('/create');
  await page.getByRole('button', { name: /Caveat/ }).click();
  await expect(page.getByRole('button', { name: /Caveat/ })).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('button', { name: 'Articulated name' })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: /Bungee/ })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: /Caveat/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Nunito/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fredoka/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Bungee/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Montserrat Black/ })).toBeEnabled();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
});
test('supports bounded zoom, preview surfaces, locales, and configurable 3MF export', async ({
  page,
}) => {
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 10000 });
  await expect(page.getByRole('region', { name: 'Model summary' })).toBeVisible();
  for (let click = 0; click < 8; click += 1)
    await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.locator('.surface-trigger').click();
  await page
    .getByRole('dialog', { name: 'Preview surface' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'dark');
  await page.locator('.surface-trigger').click();
  await page
    .getByRole('dialog', { name: 'Preview surface' })
    .getByRole('button', { name: 'Reset surface' })
    .click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'matte');
  await selectLocale(page, 'ru');
  await page.getByRole('button', { name: 'Экспорт' }).click();
  await expect(page.getByRole('dialog', { name: 'Выберите экспорт' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /3MF · единый объект/ }),
  ).toBeEnabled();
  const download = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /3MF · единый объект/ })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.3mf$/);
});
test('supports beta templates and premium local scene presets', async ({ page }) => {
  await page.goto('/create');
  await expect(page.getByRole('button', { name: 'Frame' })).toHaveCount(0);
  for (const template of ['Articulated name', 'Nameplate', 'Plant label', 'Name keychain']) {
    await page.getByRole('button', { name: template }).click();
    await expect(page.locator('.status-pill')).toHaveText(/Ready|Готово/, { timeout: 10000 });
    if (template === 'Nameplate')
      await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  }
  await page.locator('.surface-trigger').click();
  await page
    .getByRole('dialog', { name: 'Preview surface' })
    .getByRole('button', { name: 'Wood board' })
    .click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'wood');
  await page.locator('.surface-trigger').click();
  await page
    .getByRole('dialog', { name: 'Preview surface' })
    .getByRole('button', { name: 'Metal board' })
    .click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-surface', 'metal');
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
});
test('scopes styles to supported templates and keeps the Montserrat preview visible', async ({
  page,
}) => {
  await page.goto('/create');
  const readMontserratPreview = async () => {
    const montserrat = page.getByRole('button', { name: /Montserrat Black/ });

    await expect(montserrat).toBeVisible();
    return montserrat.locator('span').evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        width: element.getBoundingClientRect().width,
        family: style.fontFamily,
        weight: style.fontWeight,
      };
    });
  };

  const nameKeychainPreview = await readMontserratPreview();
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  const montserrat = page.getByRole('button', { name: /Montserrat Black/ });
  await expect(montserrat).toBeVisible();
  const articulatedPreview = await readMontserratPreview();
  expect(nameKeychainPreview.width).toBeGreaterThan(0);
  expect(articulatedPreview.width).toBeGreaterThan(0);
  expect(nameKeychainPreview.family).toBe(articulatedPreview.family);
  expect(nameKeychainPreview.weight).toBe(articulatedPreview.weight);
  await page.getByRole('button', { name: 'Nameplate' }).click();
  await expect(page.getByRole('heading', { name: 'Style' })).toHaveCount(0);
  await expect(page.getByLabel('Keyring hole')).toHaveCount(0);
  await expect(page.getByLabel('Text tilt')).toBeVisible();
  await expect(page.getByLabel('Text lift')).toBeVisible();
  await expect(page.getByLabel('Embed depth')).toBeVisible();
});
test('renders the plant label as a pointed T-shaped printable template', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Plant label' }).click();
  await expect(page.getByLabel('Stake length')).toBeVisible();
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
});
test('supports the Magnet ribbon workflow with subtitle hardware guidance', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Magnet' }).click();
  await expect(page.getByRole('button', { name: 'Plain' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Ribbon tail length')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ribbon' }).click();
  await expect(page.getByLabel('Ribbon tail length')).toBeVisible();
  const subtitleInput = page.getByLabel('Subtitle or short message');
  await expect(subtitleInput).toBeVisible();
  await subtitleInput.fill('2026');
  await page.getByTestId('shape-settings').getByRole('radio', { name: 'Secondary' }).click();
  await expect(page.getByLabel('Customizer controls').getByText(/10\.4 mm diameter/)).toBeVisible();
  await page.getByRole('button', { name: 'Bottom view' }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-view', 'bottom');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an export' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /STL file/ })).toBeEnabled();
});
test('keeps subtitle fields full-width, spaced, and keyboard-visible', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('#boot-shell')).toBeHidden();
  const customizer = page.locator('main[aria-label="Customizer"]:not(.customizer-boot-frame)');
  const shape = customizer.getByTestId('shape-settings');
  const subtitleInput = customizer.getByLabel('Subtitle or short message');
  await subtitleInput.fill('ROLE');
  await shape.getByRole('radio', { name: 'Secondary' }).click();
  const subtitle = shape.getByTestId('subtitle-settings');
  await expect(subtitle).toBeVisible();

  const metrics = await subtitle.evaluate((section) => {
    const fields = Array.from(
      section.querySelectorAll<HTMLElement>('.subtitle-input-control, .range-control'),
    );
    const sectionRect = section.getBoundingClientRect();
    const boxes = fields.map((field) => {
      const rect = field.getBoundingClientRect();
      const control = field.querySelector<HTMLElement>('input, select');
      const controlRect = control?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        controlWidth: controlRect?.width ?? 0,
      };
    });
    const gaps = boxes.slice(1).map((box, index) => box.top - boxes[index].bottom);
    return {
      sectionWidth: sectionRect.width,
      boxes,
      gaps,
      rowGap: Number.parseFloat(getComputedStyle(section).rowGap),
    };
  });

  expect(metrics.boxes.length).toBe(6);
  expect(metrics.boxes.every((box) => box.width > 0 && box.controlWidth > 0)).toBe(true);
  expect(metrics.boxes.every((box) => box.controlWidth <= box.width + 0.5)).toBe(true);
  expect(metrics.boxes.every((box) => box.right <= metrics.boxes[0].right + 0.5)).toBe(true);
  expect(metrics.gaps.every((gap) => Math.abs(gap - metrics.rowGap) < 1.5)).toBe(true);
  const reset = subtitle.getByRole('button', { name: 'Reset subtitle' });
  const input = customizer.getByTestId('subtitle-input').locator('.subtitle-input');
  const nameBox = await customizer.getByLabel('Name or text').boundingBox();
  const subtitleBox = await customizer.getByTestId('subtitle-input').boundingBox();
  expect(nameBox).not.toBeNull();
  expect(subtitleBox).not.toBeNull();
  expect(subtitleBox?.y ?? 0).toBeGreaterThan(nameBox?.y ?? 0);
  await reset.focus();
  await input.focus();
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS('outline-style', 'solid');
});
test('renders Heart with localized left and right words in one horizontal composition', async ({
  page,
}) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Heart' }).click();
  const left = page.getByTestId('heart-left-input').locator('input');
  const right = page.getByTestId('heart-right-input').locator('input');
  await left.fill('I');
  await right.fill('KYIV');
  await expect(left).toHaveValue('I');
  await expect(right).toHaveValue('KYIV');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  await expect(page.locator('.viewer')).toBeVisible();
});
test('keeps Heart inputs aligned and exposes through-cut readiness', async ({ page }) => {
  await page.goto('/create');
  await expect(page.locator('#boot-shell')).toBeHidden();
  const customizer = page.locator('main[aria-label="Customizer"]:not(.customizer-boot-frame)');
  await customizer.getByTestId('style-card-heart-split').click();
  const left = customizer.getByTestId('heart-left-input').locator('input');
  const right = customizer.getByTestId('heart-right-input').locator('input');
  await left.fill('I');
  await right.fill('KYIV');
  const leftBox = await left.boundingBox();
  const rightBox = await right.boundingBox();
  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(Math.abs((leftBox?.x ?? 0) - (rightBox?.x ?? 0))).toBeLessThan(4);
  await expect(customizer.getByTestId('subtitle-settings')).toHaveCount(0);
  await customizer.getByLabel('Center treatment').selectOption('through-cut');
  await expect(customizer.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });
  await left.fill('');
  await right.fill('');
  await expect(customizer.getByRole('alert')).toContainText('Your previous design is kept.');
  await expect(left).toHaveValue('I');
  await expect(right).toHaveValue('KYIV');
  await expect(customizer.locator('.status-pill')).toHaveText(/Ready/);
  await expect(customizer.getByRole('button', { name: 'Fix this' })).toHaveCount(0);
});
test('shows only template-relevant shape controls', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Plant label' }).click();
  await expect(page.getByRole('slider', { name: 'Keyring hole diameter' })).toHaveCount(0);
  await expect(page.getByLabel('Letter spacing')).toBeVisible();
  await expect(page.getByLabel('Stake length')).toBeVisible();
  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.getByRole('slider', { name: 'Keyring hole diameter' })).toBeVisible();
  await expect(page.getByLabel('Letter spacing')).toHaveCount(0);
  await expect(page.getByLabel('Border padding')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nameplate' }).click();
  await expect(page.getByLabel('Corner radius')).toBeVisible();
});

test('keeps template, style, refine, and print choices beside their related settings', async ({
  page,
}) => {
  await page.goto('/create');

  await page.getByRole('button', { name: 'Magnet' }).click();
  await expect(page.getByTestId('magnet-controls')).toBeVisible();
  await expect(page.getByLabel('Magnet size')).toBeVisible();
  await expect(page.getByLabel('Pocket placement')).toBeVisible();
  await expect(
    page
      .getByTestId('magnet-controls')
      .locator('xpath=ancestor::*[@data-control-group="template-details"]'),
  ).toContainText('Template details');
  await expect(page.locator('[data-control-group="style"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-control-group="refine"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-control-group="print"]:visible').first()).toBeVisible();

  await page.getByRole('button', { name: 'Articulated name' }).click();
  await expect(page.locator('[data-control-group="style"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-control-group="style-details"]:visible')).toHaveCount(0);
  await expect(page.getByLabel('Joint clearance')).toBeVisible();

  await page.getByRole('button', { name: 'Nameplate' }).click();
  await expect(page.locator('[data-control-group="style"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-control-group="style-details"]:visible')).toHaveCount(0);
  await expect(page.getByLabel('Text tilt')).toBeVisible();

  await page.getByRole('button', { name: 'Name keychain' }).click();
  await page.getByTestId('style-card-heart-split').filter({ visible: true }).first().click();
  const heartDetails = page.getByTestId('heart-settings').filter({ visible: true }).first();
  await expect(heartDetails).toBeVisible();
  await expect(heartDetails.getByLabel('Heart size')).toBeVisible();
  await expect(heartDetails.getByLabel('Heart border')).toBeVisible();
  await expect(heartDetails.getByLabel('Left gap')).toBeVisible();
  await expect(heartDetails.getByLabel('Right gap')).toBeVisible();
  await expect(heartDetails.getByLabel('Vertical offset')).toBeVisible();
  await expect(heartDetails.getByLabel('Center treatment')).toBeVisible();
});

test('keeps the accepted preview when candidate geometry validation rejects an edge finish', async ({
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
          params?: { styleId?: string; edgeFinish?: string };
        };
        if (
          request.type === 'validate' &&
          request.params?.styleId === 'heart-split' &&
          request.params.edgeFinish === 'chamfer'
        ) {
          queueMicrotask(() =>
            this.dispatchEvent(
              new MessageEvent('message', {
                data: {
                  type: 'error',
                  requestId: request.requestId,
                  message: 'Injected candidate rejection for UI recovery coverage.',
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

  await page.goto('/create');
  await expect(page.locator('#boot-shell')).toBeHidden();
  await page.getByTestId('style-card-heart-split').filter({ visible: true }).first().click();
  await expect(page.locator('.status-pill:visible').first()).toHaveText(/Ready/, {
    timeout: 10000,
  });
  const acceptedGeneration = await page
    .locator('main[aria-label="Customizer"]:not(.customizer-boot-frame) .preview-panel')
    .getAttribute('data-generation-id');
  if (!acceptedGeneration) throw new Error('The accepted preview has no generation id.');

  const chamfer = page.getByRole('radio', { name: 'Chamfer' }).filter({ visible: true }).first();
  await chamfer.check();
  await expect(page.getByRole('alert')).toContainText('Your previous design is kept.');
  await expect(
    page.getByRole('radio', { name: 'Sharp' }).filter({ visible: true }).first(),
  ).toBeChecked();
  await expect(page.locator('.status-pill:visible').first()).toHaveText(/Ready/);
  await expect(
    page
      .locator('main[aria-label="Customizer"]:not(.customizer-boot-frame) .preview-panel')
      .first(),
  ).toHaveAttribute('data-generation-id', acceptedGeneration);

  const review = page
    .getByRole('button', { name: 'Review this setting' })
    .filter({ visible: true })
    .first();
  await review.click();
  await expect(
    page.getByRole('radio', { name: 'Sharp' }).filter({ visible: true }).first(),
  ).toBeFocused();
});

test('ignores a stale candidate rejection after a newer geometry candidate is accepted', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let rejectDelayedRequest: (() => void) | undefined;
    (window as Window & { releaseStaleCandidate?: () => void }).releaseStaleCandidate = () => {
      rejectDelayedRequest?.();
    };
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
          params?: { styleId?: string; heartSizeMm?: number };
        };
        if (
          request.type === 'validate' &&
          request.params?.styleId === 'heart-split' &&
          request.params.heartSizeMm === 24
        ) {
          const requestId = request.requestId;
          rejectDelayedRequest = () =>
            this.dispatchEvent(
              new MessageEvent('message', {
                data: {
                  type: 'error',
                  requestId,
                  message: 'Stale injected rejection for latest-candidate coverage.',
                },
              }),
            );
          return;
        }
        if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
        else super.postMessage(message, transferOrOptions);
      }
    };
  });

  await page.goto('/create');
  await expect(page.locator('#boot-shell')).toBeHidden();
  const customizer = page.locator('main[aria-label="Customizer"]:not(.customizer-boot-frame)');
  await customizer.getByTestId('style-card-heart-split').click();
  await expect(customizer.locator('.status-pill')).toHaveText(/Ready/, { timeout: 10000 });

  const heartSize = customizer.getByLabel('Heart size');
  const exportButton = page
    .getByRole('button', { name: 'Export' })
    .filter({ visible: true })
    .first();
  await heartSize.fill('24');
  await expect(customizer.locator('.candidate-feedback[role="status"]')).toBeVisible();
  await expect(exportButton).toBeDisabled();
  await heartSize.fill('26');
  await expect(customizer.locator('.candidate-feedback')).toBeHidden({ timeout: 10000 });
  await expect(heartSize).toHaveValue('26');
  await expect(exportButton).toBeEnabled();
  await expect(customizer.locator('.status-pill')).toHaveText(/Ready/);

  await page.evaluate(() => {
    (window as Window & { releaseStaleCandidate?: () => void }).releaseStaleCandidate?.();
  });
  await expect(customizer.locator('.candidate-feedback-rejected')).toHaveCount(0);
  await expect(heartSize).toHaveValue('26');
  await expect(customizer.locator('.status-pill')).toHaveText(/Ready/);
});
test('resets each model section without changing unrelated choices', async ({ page }) => {
  await page.goto('/create');
  await page.getByLabel('Name or text').fill('OLIVER');
  await page.getByRole('button', { name: /Caveat/ }).click();
  await page.getByRole('button', { name: 'Plant label' }).click();
  await page.getByRole('button', { name: 'Bubble' }).click();
  await page.getByLabel('Text size').fill('30');

  await page.getByRole('button', { name: 'Reset shape' }).click();
  await expect(page.getByLabel('Text size')).toHaveValue('30');
  await expect(page.getByRole('button', { name: 'Plant label' })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Bubble' })).toHaveClass(/selected/);

  await page.getByRole('button', { name: 'Reset style' }).click();
  await expect(page.getByRole('button', { name: 'Contour' })).toHaveClass(/selected/);

  await page.getByTestId('font-browser').getByRole('button', { name: 'Reset font' }).click();
  await expect(page.getByRole('button', { name: /Nunito/ })).toHaveClass(/selected/);
  await expect(page.getByLabel('Text size')).toHaveValue('20');
  await expect(page.getByLabel('Name or text')).toHaveValue('OLIVER');

  await page.getByRole('button', { name: 'Reset name' }).click();
  await expect(page.getByLabel('Name or text')).toHaveValue('ALEX');

  await page.getByRole('button', { name: 'Reset template' }).click();
  await expect(page.getByRole('button', { name: 'Name keychain' })).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Contour' })).toHaveClass(/selected/);
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1280, height: 720 },
]) {
  test(`keeps the desktop workspace usable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/create');
    await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 10000 });
    const layout = await page.evaluate(() => {
      const controls = document.querySelector('.controls-panel')!.getBoundingClientRect();
      const header = document.querySelector('.topbar')!.getBoundingClientRect();
      const exportButton = document.querySelector('.export-header-button')!.getBoundingClientRect();
      const shareButton = document.querySelector('.share-header-button')!.getBoundingClientRect();
      const languagePicker = document
        .querySelector('.language-picker-trigger')!
        .getBoundingClientRect();
      const viewer = document.querySelector('.viewer')!.getBoundingClientRect();
      return {
        headerTop: header.top,
        headerBottom: header.bottom,
        controlsTop: controls.top,
        controlsBottom: controls.bottom,
        exportTop: exportButton.top,
        exportBottom: exportButton.bottom,
        exportCenter: (exportButton.left + exportButton.right) / 2,
        viewportCenter: window.innerWidth / 2,
        shareRight: shareButton.right,
        languageLeft: languagePicker.left,
        languageTop: languagePicker.top,
        languageBottom: languagePicker.bottom,
        viewerWidth: viewer.width,
        viewerHeight: viewer.height,
      };
    });
    expect(layout.controlsTop).toBeGreaterThanOrEqual(0);
    expect(layout.headerTop).toBeGreaterThanOrEqual(0);
    expect(layout.headerBottom).toBeLessThanOrEqual(layout.controlsTop);
    expect(layout.exportTop).toBeGreaterThanOrEqual(layout.headerTop);
    expect(layout.exportBottom).toBeLessThanOrEqual(layout.headerBottom);
    expect(Math.abs(layout.exportCenter - layout.viewportCenter)).toBeLessThanOrEqual(1);
    expect(layout.exportBottom - layout.exportTop).toBeGreaterThanOrEqual(36);
    expect(layout.languageLeft).toBeGreaterThanOrEqual(layout.shareRight);
    expect(layout.languageTop).toBeGreaterThanOrEqual(layout.headerTop);
    expect(layout.languageBottom).toBeLessThanOrEqual(layout.headerBottom);
    expect(layout.viewerWidth).toBeGreaterThan(360);
    expect(layout.viewerHeight).toBeGreaterThan(260);
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Keyring hole diameter' })).toBeVisible();
    await expect(page.locator('.viewer')).toBeInViewport();
  });
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-2x', width: 390, height: 844 },
]) {
  test(`renders one accessible export trigger on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/create');
    await expect(page.locator('.export-header-button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Export' })).toHaveCount(1);
  });
}

test('keeps the complete articulated shape control set reachable in the scrollable pane', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/create');
  await page.getByRole('button', { name: 'Articulated name' }).click();
  const controls = page.locator('.controls-panel');
  const metrics = await controls.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  const scrollTop = await controls.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
  await expect(page.getByLabel('Max joint angle')).toBeInViewport();
});
test('keeps the customizer footer in the desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText('Ready to print', { timeout: 10000 });

  const pageState = await page.evaluate(() => {
    const footer = document.querySelector('.customizer-footer')!.getBoundingClientRect();
    const controls = document.querySelector('.controls-panel')!;
    return {
      footerTop: footer.top,
      footerBottom: footer.bottom,
      viewportHeight: window.innerHeight,
      controlsClientHeight: controls.clientHeight,
      controlsScrollHeight: controls.scrollHeight,
    };
  });
  expect(pageState.footerTop).toBeGreaterThanOrEqual(0);
  expect(pageState.footerBottom).toBeLessThanOrEqual(pageState.viewportHeight);
  expect(pageState.controlsScrollHeight).toBeGreaterThan(pageState.controlsClientHeight);
  await expect(page.locator('.customizer-footer')).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
test('keeps the preview prominent and touch targets comfortable at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');
  await expect(page.locator('.viewer')).toBeVisible();
  const dimensions = await page
    .locator('.viewer')
    .evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }));
  expect(dimensions.height).toBeLessThanOrEqual(500);
  expect(dimensions.width).toBeGreaterThan(300);
  const cameraButtonHeight = await page
    .getByRole('button', { name: 'Home view' })
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(cameraButtonHeight).toBeGreaterThanOrEqual(44);
  const surfaceButtonHeight = await page
    .locator('.surface-trigger')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(surfaceButtonHeight).toBeGreaterThanOrEqual(44);
});
