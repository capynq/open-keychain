export type KeyringPosition = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right';

export const KEYRING_POSITIONS: readonly KeyringPosition[] = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
];

export const keyringPositionNameKey = (position: KeyringPosition): string =>
  ({
    left: 'keyringPositionLeft',
    right: 'keyringPositionRight',
    top: 'keyringPositionTop',
    bottom: 'keyringPositionBottom',
    'top-left': 'keyringPositionTopLeft',
    'top-right': 'keyringPositionTopRight',
  })[position];
