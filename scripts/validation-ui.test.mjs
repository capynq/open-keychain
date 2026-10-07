import process from 'node:process';
import { describe, expect, it, vi } from 'vitest';
import { formatStyledLine, statusStyle, supportsColor, ValidationUi } from './validation-ui.mjs';

const ESC = String.fromCharCode(27);
const stripAnsi = (value) =>
  value
    .replaceAll(`${ESC}[1;38;5;81m`, '')
    .replaceAll(`${ESC}[38;5;81m`, '')
    .replaceAll(`${ESC}[36m`, '')
    .replaceAll(`${ESC}[0m`, '');

describe('validation TUI colors', () => {
  it('enables color only for an interactive non-CI terminal that allows it', () => {
    expect(supportsColor({ interactive: true, environment: { TERM: 'xterm-256color' } })).toBe(
      true,
    );
    expect(supportsColor({ interactive: true, environment: { TERM: 'dumb' } })).toBe(false);
    expect(supportsColor({ interactive: true, environment: { TERM: 'xterm', NO_COLOR: '' } })).toBe(
      false,
    );
    expect(supportsColor({ interactive: true, environment: { CI: 'true', TERM: 'xterm' } })).toBe(
      false,
    );
    expect(
      supportsColor({
        interactive: false,
        environment: { TERM: 'xterm-256color', FORCE_COLOR: '1' },
      }),
    ).toBe(false);
  });

  it('maps gate states to distinct semantic colors', () => {
    expect(statusStyle('queued')).toBe('muted');
    expect(statusStyle('running')).toBe('active');
    expect(statusStyle('passed')).toBe('success');
    expect(statusStyle('failed')).toBe('failure');
    expect(statusStyle('cached')).toBe('cached');
    expect(statusStyle('skipped')).toBe('warning');
    expect(statusStyle('cancelled')).toBe('muted');
    expect(statusStyle('blocked')).toBe('warning');
    expect(statusStyle('not-required')).toBe('muted');
  });

  it('styles only after truncation and preserves the requested display width', () => {
    const rendered = formatStyledLine(
      { text: 'ABCDEF', spans: [{ start: 0, end: 6, style: 'active', bold: true }] },
      4,
      { colors: true, palette: { active: '38;5;81' } },
    );
    expect(rendered).toBe('\u001b[1;38;5;81mABC\u001b[0m…');
    expect(stripAnsi(rendered)).toBe('ABC…');
  });

  it('keeps Unicode truncation and plain rendering free of ANSI controls', () => {
    const line = { text: '🌟abcd', spans: [{ start: 0, end: 6, style: 'active' }] };
    const rendered = formatStyledLine(line, 4, {
      colors: true,
      palette: { active: '36' },
    });
    expect(stripAnsi(rendered)).toBe('🌟a…');
    expect(formatStyledLine(line, 4)).toBe('🌟a…');
  });

  it('keeps plain-mode lifecycle output free of ANSI controls', async () => {
    const writes = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const ui = new ValidationUi({
      profile: 'quick',
      branch: 'main',
      sha: '1234567890',
      changedCount: 1,
      gates: [{ id: 'build', name: 'Build' }],
      logDir: '/tmp/validation.log',
      mode: 'plain',
      environment: { TERM: 'xterm-256color', FORCE_COLOR: '1' },
    });

    try {
      await ui.start();
      ui.handle({ status: 'gate-started', gateId: 'build' });
      await ui.close({ summary: 'Validation passed' });
      expect(writes.join('').includes(ESC)).toBe(false);
    } finally {
      await ui.close();
      writeSpy.mockRestore();
    }
  });
});
