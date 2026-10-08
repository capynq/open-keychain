/* eslint-disable no-control-regex */
import fs from 'node:fs';
import process from 'node:process';
import readline from 'node:readline';
import { clearInterval, setInterval, setTimeout } from 'node:timers';
import tty from 'node:tty';

const STATUS = {
  queued: '○',
  running: '⟳',
  passed: '✓',
  failed: '✗',
  cached: '◆',
  skipped: '⊘',
  cancelled: '■',
  blocked: '!',
  'not-required': '—',
};
const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const COLOR_16 = {
  accent: '33',
  active: '36',
  success: '32',
  failure: '31',
  warning: '33',
  cached: '35',
  muted: '2',
  info: '34',
};
const COLOR_256 = {
  accent: '38;5;173',
  active: '38;5;81',
  success: '38;5;114',
  failure: '38;5;203',
  warning: '38;5;221',
  cached: '38;5;141',
  muted: '38;5;245',
  info: '38;5;75',
};
const STATUS_STYLE = {
  queued: 'muted',
  running: 'active',
  passed: 'success',
  failed: 'failure',
  cached: 'cached',
  skipped: 'warning',
  cancelled: 'muted',
  blocked: 'warning',
  'not-required': 'muted',
};

export const supportsColor = ({ interactive, environment = process.env } = {}) =>
  Boolean(interactive) &&
  !environment.CI &&
  environment.TERM !== 'dumb' &&
  !Object.hasOwn(environment, 'NO_COLOR');

const paletteFor = (environment) =>
  /(?:256color|truecolor|direct)/i.test(`${environment.TERM ?? ''} ${environment.COLORTERM ?? ''}`)
    ? COLOR_256
    : COLOR_16;

export const formatStyledLine = (
  { text, spans = [] },
  width,
  { colors = false, palette = COLOR_16 } = {},
) => {
  const clipped = truncate(text, width);
  const wasTruncated = widthOf(text) > width;
  const visibleTextLength = wasTruncated
    ? Math.max(0, clipped.length - (width >= 2 ? 1 : 0))
    : clipped.length;
  if (!colors || spans.length === 0)
    return clipped + ' '.repeat(Math.max(0, width - widthOf(clipped)));

  const output = [];
  let cursor = 0;
  for (const span of spans) {
    const start = Math.max(cursor, span.start);
    const end = Math.min(visibleTextLength, span.end);
    if (end <= start) continue;
    output.push(text.slice(cursor, start));
    const codes = [span.bold ? '1' : '', palette[span.style]].filter(Boolean).join(';');
    output.push(`\u001b[${codes}m${text.slice(start, end)}\u001b[0m`);
    cursor = end;
  }
  output.push(text.slice(cursor, visibleTextLength));
  if (wasTruncated) output.push('…');
  const visibleWidth = widthOf(clipped);
  output.push(' '.repeat(Math.max(0, width - visibleWidth)));
  return output.join('');
};

export const statusStyle = (status) => STATUS_STYLE[status] ?? 'muted';

const widthOf = (value) => {
  let width = 0;
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code === 0 || code < 32 || (code >= 0x300 && code <= 0x36f)) continue;
    width +=
      code >= 0x1100 &&
      (code <= 0x115f ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        code >= 0x1f300)
        ? 2
        : 1;
  }
  return width;
};
const truncate = (value, maxWidth) => {
  value = stripTerminalControls(value);
  if (maxWidth < 1) return '';
  if (widthOf(value) <= maxWidth) return value;
  const suffix = maxWidth >= 2 ? '…' : '';
  let result = '';
  for (const char of value) {
    if (widthOf(result + char + suffix) > maxWidth) break;
    result += char;
  }
  return result + suffix;
};
const pad = (value, width) => {
  const text = truncate(String(value), width);
  return text + ' '.repeat(Math.max(0, width - widthOf(text)));
};
const duration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};
const timeStamp = () => new Date().toLocaleTimeString();
// Terminal control bytes are intentionally matched here so child output cannot corrupt the TUI.
const stripTerminalControls = (value) =>
  String(value)
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

export const eventFor = (runId, gateId, status, values = {}) => ({
  schemaVersion: 1,
  runId,
  gateId,
  timestamp: new Date().toISOString(),
  status,
  ...values,
});

export class ValidationUi {
  constructor({
    profile,
    branch,
    sha,
    changedCount,
    gates,
    logDir,
    mode = 'auto',
    onSkip,
    onCancel,
    environment = process.env,
  }) {
    this.profile = profile;
    this.branch = branch;
    this.sha = sha;
    this.changedCount = changedCount;
    this.selectedGates = gates;
    const standardRows = [
      ['format', 'Format'],
      ['lint', 'Lint'],
      ['typecheck', 'Typecheck'],
      ['build', 'Build'],
      ['unit', 'Unit'],
      ['browser', 'Browser'],
      ['geometry', 'Geometry'],
    ];
    const matched = new Set();
    const rows = standardRows.map(([id, name]) => {
      const gate = gates.find((item) =>
        id === 'unit' ? item.id.startsWith('unit') : item.id === id || item.id.startsWith(`${id}:`),
      );
      if (gate) matched.add(gate.id);
      return gate ?? { id, name, status: 'not-required' };
    });
    this.gates = [
      ...rows,
      ...gates.filter(
        (gate) => !matched.has(gate.id) && !standardRows.some(([id]) => gate.id === id),
      ),
    ].map((gate) => ({
      ...gate,
      status: gate.status ?? 'queued',
      completed: 0,
      total: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      detail: '',
    }));
    this.logDir = logDir;
    this.onSkip = onSkip;
    this.onCancel = onCancel;
    this.environment = environment;
    this.mode = mode;
    this.interactive =
      Boolean(process.stdout.isTTY) && !environment.CI && (mode === 'tui' || mode === 'auto');
    this.colors = supportsColor({ interactive: this.interactive, environment });
    this.palette = paletteFor(environment);
    this.startedAt = Date.now();
    this.lastEventAt = this.startedAt;
    this.lastCompletionAt = this.startedAt;
    this.diagnostics = [];
    this.activeCases = new Map();
    this.selectedIndex = 0;
    this.detailed = false;
    this.showLogs = false;
    this.help = false;
    this.confirmation = undefined;
    this.renderPending = false;
    this.renderTimer = undefined;
    this.plainTimer = undefined;
    this.outputRows = 0;
    this.previousRaw = false;
    this.closed = false;
    this.alternateScreen = false;
    this.terminalRestored = false;
    this.exitHandler = () => this.#restoreTerminal();
  }

  async start() {
    if (this.interactive) {
      try {
        this.ttyFd = fs.openSync('/dev/tty', 'r+');
        this.keyInput = new tty.ReadStream(this.ttyFd);
        this.previousRaw = this.keyInput.isRaw;
        readline.emitKeypressEvents(this.keyInput);
        this.keyInput.setRawMode(true);
        this.keyInput.on('keypress', (value, key) => this.#onKey(value, key));
        process.stdout.on('resize', () => this.#scheduleRender(true));
        process.stdout.write('\u001b[?1049h\u001b[?25l');
        this.alternateScreen = true;
        process.once('exit', this.exitHandler);
        this.renderTimer = setInterval(() => this.#scheduleRender(), 150);
      } catch {
        this.interactive = false;
        this.colors = false;
        this.#closeInput();
      }
    }
    if (!this.interactive) {
      process.stdout.write(
        `Open Keychain · validation · ${this.branch} · ${this.sha} · profile: ${this.profile}\n`,
      );
      this.plainTimer = setInterval(() => this.#printSnapshot(), 7000);
    }
    this.handle({ status: 'run-started', timestamp: new Date().toISOString() });
  }

  handle(event) {
    this.lastEventAt = Date.now();
    const failedCase =
      event.status === 'case-completed' &&
      ['failed', 'timedOut', 'interrupted'].includes(event.outcome);
    if (event.status === 'diagnostic' || event.status === 'failed' || failedCase) {
      const message = stripTerminalControls(
        event.message ??
          event.detail ??
          (failedCase
            ? `${event.gateId ?? 'test'} failed: ${event.name}`
            : `${event.gateId ?? 'validation'} failed`),
      );
      this.diagnostics.push(`${timeStamp()} ${message}`);
      this.diagnostics = this.diagnostics.slice(-5);
      if (!this.interactive) process.stderr.write(`${message}\n`);
    }
    if (event.status === 'case-started') {
      this.activeCases.set(`${event.gateId}:${event.workerId ?? 0}`, {
        name: event.name,
        startedAt: Date.now(),
        gateId: event.gateId,
        workerId: event.workerId,
      });
      if (event.gateId === 'browser') {
        const browser = this.gates.find((item) => item.id === 'browser');
        if (browser) browser.currentName = event.name;
      }
    } else if (event.status === 'case-completed') {
      this.activeCases.delete(`${event.gateId}:${event.workerId ?? 0}`);
      this.lastCompletionAt = Date.now();
      if (event.gateId === 'browser') {
        const browser = this.gates.find((item) => item.id === 'browser');
        if (browser?.currentName === event.name) browser.currentName = undefined;
      }
    }
    if (
      event.status === 'gate-completed' ||
      event.status === 'gate-cache-hit' ||
      event.status === 'gate-skipped' ||
      event.status === 'gate-cancelled'
    )
      this.lastCompletionAt = Date.now();
    const gate = this.gates.find((item) => item.id === event.gateId);
    if (gate) {
      if (event.status === 'gate-started') {
        gate.status = 'running';
        gate.startedAt = Date.now();
        gate.detail = event.detail ?? '';
        gate.logPath = event.logPath;
      }
      if (event.status === 'gate-progress') {
        gate.completed = event.completed ?? gate.completed;
        gate.total = event.total ?? gate.total;
        gate.detail = event.detail ?? gate.detail;
      }
      if (event.status === 'gate-cache-hit') {
        gate.status = 'cached';
        gate.finishedAt = Date.now();
        gate.detail = event.reason ?? 'cache hit';
      }
      if (event.status === 'gate-completed') {
        gate.status = event.ok ? 'passed' : 'failed';
        gate.finishedAt = Date.now();
        gate.detail = event.detail ?? '';
        gate.completed = event.completed ?? gate.completed;
        gate.total = event.total ?? gate.total;
      }
      if (event.status === 'gate-skipped') {
        gate.status = 'skipped';
        gate.finishedAt = Date.now();
        gate.detail = 'SKIPPED BY USER';
      }
      if (event.status === 'gate-cancelled') {
        gate.status = 'cancelled';
        gate.finishedAt = Date.now();
      }
      if (event.status === 'gate-blocked') {
        gate.status = 'blocked';
        gate.finishedAt = Date.now();
        gate.detail = event.detail ?? 'dependency unavailable';
      }
      if (event.status === 'gate-queued') gate.status = 'queued';
      if (event.currentName) gate.currentName = event.currentName;
    }
    if (
      !this.interactive &&
      [
        'gate-started',
        'gate-completed',
        'gate-cache-hit',
        'gate-skipped',
        'gate-blocked',
        'gate-cancelled',
      ].includes(event.status)
    ) {
      process.stdout.write(
        `[${event.gateId}] ${event.status.replace('gate-', '')}${event.detail ? `: ${event.detail}` : ''}\n`,
      );
    }
    this.#scheduleRender();
  }

  async close({ summary, partial = false } = {}) {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.renderTimer);
    clearInterval(this.plainTimer);
    if (this.interactive) {
      this.#restoreTerminal();
    }
    const elapsed = duration(Date.now() - this.startedAt);
    if (summary)
      process.stdout.write(
        `${partial ? 'Local validation partial; CI must complete before deployment. ' : ''}${summary} (${elapsed})\n`,
      );
  }

  #closeInput() {
    try {
      if (this.keyInput?.isRaw) this.keyInput.setRawMode(this.previousRaw);
    } catch {
      /* terminal already closed */
    }
    try {
      this.keyInput?.destroy();
    } catch {
      /* terminal already closed */
    }
    try {
      if (this.ttyFd !== undefined) fs.closeSync(this.ttyFd);
    } catch {
      /* terminal already closed */
    }
    this.keyInput = undefined;
    this.ttyFd = undefined;
  }

  #restoreTerminal() {
    if (this.terminalRestored) return;
    this.terminalRestored = true;
    process.removeListener('exit', this.exitHandler);
    this.#closeInput();
    if (this.alternateScreen) {
      process.stdout.write('\u001b[?25h\u001b[?1049l');
      this.alternateScreen = false;
    }
  }

  #onKey(value, key = {}) {
    if (key.ctrl && key.name === 'c') {
      this.onCancel?.();
      return;
    }
    if (this.confirmation) {
      const confirmation = this.confirmation;
      this.confirmation = undefined;
      if (value.toLowerCase() === 'y') this.onSkip?.(confirmation.id);
      else this.diagnostics.push('Skip cancelled.');
      this.#scheduleRender(true);
      return;
    }
    if (key.name === 'up') this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    else if (key.name === 'down')
      this.selectedIndex = Math.min(this.gates.length - 1, this.selectedIndex + 1);
    else if (value === 'v') this.detailed = !this.detailed;
    else if (value === 'l') this.showLogs = !this.showLogs;
    else if (value === '?') this.help = !this.help;
    else if (value === 's') {
      const selected = this.gates[this.selectedIndex];
      const requiredDependent =
        selected &&
        this.selectedGates.some((gate) => gate.required && gate.dependsOn?.includes(selected.id));
      if (!selected || selected.required || requiredDependent)
        this.diagnostics.push(
          'This gate is required by the selected profile and cannot be skipped.',
        );
      else this.confirmation = { id: selected.id, name: selected.name };
    }
    this.diagnostics = this.diagnostics.slice(-5);
    this.#scheduleRender(true);
  }

  #scheduleRender(force = false) {
    if (!this.interactive || this.renderPending) return;
    this.renderPending = true;
    setTimeout(
      () => {
        this.renderPending = false;
        this.#render(force);
      },
      force ? 0 : 50,
    );
  }

  #render() {
    const columns = Math.max(1, process.stdout.columns || 80);
    const rows = Math.max(8, process.stdout.rows || 24);
    const width = columns - 1;
    const elapsed = Date.now() - this.startedAt;
    const completed = this.selectedGates.filter((gate) => {
      const row = this.gates.find((item) => item.id === gate.id);
      return (
        row &&
        ['passed', 'failed', 'cached', 'skipped', 'cancelled', 'blocked'].includes(row.status)
      );
    }).length;
    const activeWorkers =
      this.activeCases.size || this.gates.filter((gate) => gate.status === 'running').length;
    const lines = [];
    const pushLine = (text, spans = []) => lines.push({ text, spans });
    const title = `Open Keychain · pre-push · ${this.branch} · ${this.sha} · profile: ${this.profile}`;
    const profileOffset = title.lastIndexOf(this.profile);
    pushLine(title, [
      { start: 0, end: profileOffset, style: 'accent', bold: true },
      { start: profileOffset, end: title.length, style: 'active', bold: true },
    ]);
    const summary = `Changed: ${this.changedCount} · Gates: ${completed}/${this.selectedGates.length} · Active workers: ${activeWorkers} · Elapsed: ${duration(elapsed)}`;
    const gatesOffset = summary.indexOf('Gates:');
    pushLine(summary, [
      {
        start: gatesOffset,
        end: gatesOffset + `Gates: ${completed}/${this.selectedGates.length}`.length,
        style: 'active',
        bold: true,
      },
    ]);
    pushLine('');
    const compact = width < 72;
    if (!compact)
      pushLine(
        `${pad('STATUS', 9)} ${pad('GATE', width - 48)} ${pad('DONE/TOTAL', 13)} ${pad('TIME', 8)} CACHE / PHASE`,
        [{ start: 0, end: width, style: 'muted' }],
      );
    for (const [gateIndex, gate] of this.gates.entries()) {
      const gateElapsed = gate.startedAt ? (gate.finishedAt ?? Date.now()) - gate.startedAt : 0;
      const icon =
        gate.status === 'running'
          ? spinner[Math.floor(Date.now() / 150) % spinner.length]
          : (STATUS[gate.status] ?? '?');
      const statusText =
        gate.status === 'not-required'
          ? 'not required'
          : gate.status === 'skipped'
            ? 'skipped'
            : gate.status;
      const counter = gate.total === undefined ? '—' : `${gate.completed}/${gate.total}`;
      const detail = gate.status === 'running' && !gate.detail ? 'running' : gate.detail;
      const selected = gateIndex === this.selectedIndex;
      const marker = selected ? '›' : ' ';
      const statusCell = compact
        ? `${marker}${icon} ${statusText}`
        : pad(`${marker}${icon} ${statusText}`, 10);
      const nameCell = compact ? gate.name : pad(gate.name, width - 49);
      const nameStart = statusCell.length + 1;
      const line = compact
        ? `${statusCell} ${nameCell} ${counter} ${gate.startedAt ? duration(gateElapsed) : '—'} ${detail}`
        : `${statusCell} ${nameCell} ${pad(counter, 13)} ${pad(gate.startedAt ? duration(gateElapsed) : '—', 8)} ${truncate(detail, width - 67)}`;
      const spans = [
        { start: 0, end: 1, style: 'active', bold: selected },
        { start: 1, end: statusCell.length, style: statusStyle(gate.status), bold: true },
      ];
      if (selected)
        spans.push({
          start: nameStart,
          end: nameStart + gate.name.length,
          style: 'active',
          bold: true,
        });
      pushLine(line, spans);
    }
    const unit = this.gates.find((gate) => gate.id.startsWith('unit'));
    const geometry = this.gates.find((gate) => gate.id === 'geometry');
    const browser = this.gates.find((gate) => gate.id === 'browser');
    pushLine('');
    const unitProgress = `Unit progress: ${this.#progressText(unit)}`;
    const unitBar = unitProgress.indexOf('█');
    pushLine(
      unitProgress,
      unitBar >= 0
        ? [
            {
              start: unitBar,
              end: unitProgress.length,
              style: statusStyle(unit.status),
              bold: true,
            },
          ]
        : [
            {
              start: unitProgress.indexOf(':') + 2,
              end: unitProgress.length,
              style: statusStyle(unit?.status ?? 'not-required'),
            },
          ],
    );
    const geometryProgress = `Geometry progress: ${this.#progressText(geometry)}`;
    const geometryBar = geometryProgress.indexOf('█');
    pushLine(
      geometryProgress,
      geometryBar >= 0
        ? [
            {
              start: geometryBar,
              end: geometryProgress.length,
              style: statusStyle(geometry.status),
              bold: true,
            },
          ]
        : [
            {
              start: geometryProgress.indexOf(':') + 2,
              end: geometryProgress.length,
              style: statusStyle(geometry?.status ?? 'not-required'),
            },
          ],
    );
    const browserText = `Browser: ${browser ? `${browser.completed}/${browser.total ?? '—'}${browser.currentName ? ` · ${browser.currentName}` : ''}` : 'not required'}`;
    const browserValueOffset = browserText.indexOf(':') + 2;
    pushLine(browserText, [
      { start: 0, end: 'Browser:'.length, style: 'muted' },
      {
        start: browserValueOffset,
        end: browserText.length,
        style: statusStyle(browser?.status ?? 'not-required'),
      },
    ]);
    const currentUnit =
      unit?.currentName ??
      [...this.activeCases.values()].find((item) => item.gateId.startsWith('unit'))?.name ??
      '—';
    pushLine(`Current unit test: ${currentUnit}`, [
      { start: 0, end: 'Current unit test:'.length, style: 'muted' },
    ]);
    const activeGeometry = [...this.activeCases.values()]
      .filter((item) => item.gateId === 'geometry')
      .map(
        (item) => `${item.workerId ?? 0}: ${item.name} (${duration(Date.now() - item.startedAt)})`,
      );
    const geometryWorkers = `Geometry workers: ${activeGeometry.length ? activeGeometry.join(' · ') : '—'}`;
    pushLine(geometryWorkers, [
      { start: 0, end: 'Geometry workers:'.length, style: 'muted' },
      ...(activeGeometry.length
        ? [{ start: 'Geometry workers: '.length, end: geometryWorkers.length, style: 'active' }]
        : []),
    ]);
    pushLine(`Time since completion: ${duration(Date.now() - this.lastCompletionAt)}`, [
      { start: 0, end: 'Time since completion:'.length, style: 'muted' },
    ]);
    pushLine('ETA: —', [{ start: 0, end: 'ETA:'.length, style: 'muted' }]);
    pushLine(`Diagnostics${this.detailed ? ' (detailed)' : ''}:`, [
      {
        start: 0,
        end: `Diagnostics${this.detailed ? ' (detailed)' : ''}`.length,
        style: 'warning',
        bold: true,
      },
    ]);
    for (const diagnostic of this.diagnostics.slice(this.detailed ? -5 : -3))
      pushLine(`  ${truncate(diagnostic, this.detailed ? width - 2 : Math.min(120, width - 2))}`, [
        { start: 0, end: 2, style: 'failure' },
        { start: 2, end: width, style: 'failure' },
      ]);
    if (this.showLogs) {
      pushLine(`Logs: ${this.logDir}`, [{ start: 0, end: 'Logs:'.length, style: 'muted' }]);
      const selected = this.gates[this.selectedIndex];
      if (selected?.logPath) {
        try {
          const log = fs
            .readFileSync(selected.logPath, 'utf8')
            .slice(-4000)
            .trimEnd()
            .split(/\r?\n/)
            .slice(-4);
          for (const line of log) pushLine(`  ${line}`, [{ start: 0, end: width, style: 'muted' }]);
        } catch {
          pushLine('  No gate log yet.', [{ start: 0, end: width, style: 'muted' }]);
        }
      }
    }
    if (this.confirmation)
      pushLine(
        `Skip ${this.confirmation.name}? Consequence: local validation will be partial. Confirm y/N`,
        [{ start: 0, end: width, style: 'warning', bold: true }],
      );
    else if (this.help)
      pushLine(
        '↑/↓ select gate · l logs · v diagnostics · ? help · s skip optional gate · Ctrl+C cancel push',
        [{ start: 0, end: width, style: 'active' }],
      );
    else
      pushLine(
        'Keys: ↑/↓ select · l logs · v diagnostics · ? help · s skip optional · Ctrl+C cancel',
        [{ start: 0, end: 'Keys:'.length, style: 'accent', bold: true }],
      );
    const visible = lines
      .slice(0, Math.max(8, rows - 1))
      .map((line) => formatStyledLine(line, width, { colors: this.colors, palette: this.palette }));
    process.stdout.write(`\u001b[H${visible.join('\n')}\u001b[0J`);
    this.outputRows = visible.length;
  }

  #progressText(gate) {
    if (!gate) return 'not required';
    if (gate.status === 'cached') return 'cached';
    if (gate.total === undefined)
      return gate.status === 'running' ? 'collecting tests' : gate.status;
    const percent = gate.total ? Math.floor((gate.completed / gate.total) * 100) : 0;
    const width = 20;
    const filled = Math.floor((percent / 100) * width);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
    return `${bar} ${gate.completed}/${gate.total} (${percent}%)`;
  }

  #printSnapshot() {
    const active = this.gates.filter((gate) => gate.status === 'running');
    const summary = active.length
      ? active
          .map(
            (gate) =>
              `${gate.name} ${gate.completed}/${gate.total ?? '—'}${gate.detail ? ` · ${gate.detail}` : ''}`,
          )
          .join(' | ')
      : 'none';
    const completed = this.selectedGates.filter((gate) => {
      const row = this.gates.find((item) => item.id === gate.id);
      return (
        row &&
        ['passed', 'failed', 'cached', 'skipped', 'cancelled', 'blocked'].includes(row.status)
      );
    }).length;
    process.stdout.write(
      `Progress ${timeStamp()} · gates ${completed}/${this.selectedGates.length} · elapsed ${duration(Date.now() - this.startedAt)} · active: ${summary}\n`,
    );
  }
}
