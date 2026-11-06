import { recentErrors, type ErrorLogEntry } from './error-log';
import { fitMailBody, mailText, mailtoHref, type MailSection } from './support-mail';

declare const __OPEN_KEYCHAIN_ENV__: string;
declare const __OPEN_KEYCHAIN_VERSION__: string;
declare const __OPEN_KEYCHAIN_RELEASE__: string;

export const appBuildLabel = (): string => {
  const environment =
    typeof __OPEN_KEYCHAIN_ENV__ === 'undefined' ? 'local' : __OPEN_KEYCHAIN_ENV__;
  const version = typeof __OPEN_KEYCHAIN_VERSION__ === 'undefined' ? '' : __OPEN_KEYCHAIN_VERSION__;
  const release =
    typeof __OPEN_KEYCHAIN_RELEASE__ === 'undefined' ? 'local' : __OPEN_KEYCHAIN_RELEASE__;

  const shortVersion = version.slice(0, 12);

  return [release, release.includes(shortVersion) ? '' : shortVersion, environment]
    .filter(Boolean)
    .join(' · ');
};

let currentDesignUrl: (() => string | undefined) | undefined;

/** The editor registers how to link the open design, so any error report can include it. */
export const setSupportDesignUrlProvider = (
  provider: (() => string | undefined) | undefined,
): void => {
  currentDesignUrl = provider;
};

export const supportDesignUrl = (): string | undefined => {
  try {
    return currentDesignUrl?.();
  } catch {
    return undefined;
  }
};

export type SupportReportInput = {
  /** Stable failure code, e.g. `geometry-export-failed`. */
  code: string;
  /** The message the visitor saw. */
  message: string;
  diagnostic?: string;
  /** Share link of the current design; optional because it contains the visitor's text. */
  designUrl?: string;
  /** Localized lines the visitor reads first, e.g. a prompt to describe what they did. */
  intro: readonly string[];
  /** Localized note shown above the design link. */
  designNote?: string;
  locale: string;
  subject: string;
  now?: Date;
  errors?: readonly ErrorLogEntry[];
  path?: string;
  userAgent?: string;
};

export type SupportReport = { mailtoHref: string; text: string };

const time = (at: number): string => new Date(at).toISOString().slice(11, 19);

export const buildSupportReport = (input: SupportReportInput): SupportReport => {
  const now = input.now ?? new Date();
  const errors = input.errors ?? recentErrors();
  const path = input.path ?? (typeof window === 'undefined' ? '' : window.location.pathname);
  const userAgent =
    input.userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);

  const sections: MailSection[] = [
    { lines: input.intro },
    {
      lines: [
        '--- Error report ---',
        `Error: ${input.message} (${input.code})`,
        ...(input.diagnostic && input.diagnostic !== input.message
          ? [`Details: ${input.diagnostic.slice(0, 500)}`]
          : []),
        `Page: ${path}`,
        `Time: ${now.toISOString()}`,
        `App: ${appBuildLabel()}`,
        `Language: ${input.locale}`,
        `Browser: ${userAgent}`,
      ],
    },
    {
      dropOrder: 2,
      lines: input.designUrl
        ? [...(input.designNote ? [input.designNote] : []), `Design: ${input.designUrl}`]
        : [],
    },
    {
      dropOrder: 1,
      lines: errors.length
        ? [
            'Recent errors:',
            ...errors.map((entry) => `- ${time(entry.at)} ${entry.source}: ${entry.message}`),
          ]
        : [],
    },
  ];

  return {
    mailtoHref: mailtoHref(input.subject, fitMailBody(sections)),
    text: mailText(sections),
  };
};
