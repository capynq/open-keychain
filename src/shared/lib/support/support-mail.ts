export const SUPPORT_EMAIL = 'support@open-keychain.com';

/** Keeps mailto links under the length that common mail clients and webmail handlers accept. */
export const MAILTO_BODY_BUDGET = 1800;

export const mailtoHref = (subject: string, body: string, to = SUPPORT_EMAIL): string =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export type MailSection = {
  /** Lower numbers are dropped first when the body is too long; omit to always keep. */
  dropOrder?: number;
  lines: readonly string[];
};

const render = (sections: readonly MailSection[]): string =>
  sections
    .filter((section) => section.lines.length > 0)
    .map((section) => section.lines.join('\n'))
    .join('\n\n');

/**
 * Join sections, then drop the lowest-priority ones (and finally truncate) until the encoded body
 * fits the mailto budget. The copyable text should use `render` without a budget instead.
 */
export const fitMailBody = (
  sections: readonly MailSection[],
  budget = MAILTO_BODY_BUDGET,
): string => {
  let kept = [...sections];
  let body = render(kept);
  const droppable = kept
    .filter((section) => section.dropOrder !== undefined)
    .sort((a, b) => (a.dropOrder ?? 0) - (b.dropOrder ?? 0));

  for (const section of droppable) {
    if (encodeURIComponent(body).length <= budget) break;

    kept = kept.filter((candidate) => candidate !== section);
    body = render(kept);
  }

  /* Slice by code point: a lone surrogate would make encodeURIComponent throw. */
  let characters = Array.from(body);

  while (encodeURIComponent(characters.join('')).length > budget && characters.length > 0) {
    characters = characters.slice(0, Math.floor(characters.length * 0.9));
  }

  body = characters.join('');

  return body;
};

export const mailText = (sections: readonly MailSection[]): string => render(sections);
