export type ShareNetwork = 'telegram' | 'whatsapp' | 'facebook' | 'x';

export const shareNetworkUrl = (network: ShareNetwork, url: string): string => {
  const params = new URLSearchParams();

  switch (network) {
    case 'telegram':
      params.set('url', url);

      return `https://t.me/share/url?${params}`;
    case 'whatsapp':
      params.set('text', url);

      return `https://wa.me/?${params}`;
    case 'facebook':
      params.set('u', url);

      return `https://www.facebook.com/sharer/sharer.php?${params}`;
    case 'x':
      params.set('url', url);

      return `https://twitter.com/intent/tweet?${params}`;
  }
};
