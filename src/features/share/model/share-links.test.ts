import { describe, expect, it } from 'vitest';

import { shareNetworkUrl } from './share-links';

describe('shareNetworkUrl', () => {
  const designUrl = 'https://open-keychain.com/create?design=a+b&text=hello world';

  it.each([
    ['telegram', `https://t.me/share/url?${new URLSearchParams({ url: designUrl })}`],
    ['whatsapp', `https://wa.me/?${new URLSearchParams({ text: designUrl })}`],
    [
      'facebook',
      `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: designUrl })}`,
    ],
    ['x', `https://twitter.com/intent/tweet?${new URLSearchParams({ url: designUrl })}`],
  ] as const)('builds the %s adapter URL', (network, expected) => {
    expect(shareNetworkUrl(network, designUrl)).toBe(expected);
  });
});
