import { describe, expect, it } from 'vitest';

import { findAvailablePort } from './ports.mjs';

describe('available localhost ports', () => {
  it('asks the operating system for an available localhost port and closes the probe', async () => {
    let closed = false;
    const fakeServer = {
      close: (callback) => {
        closed = true;
        callback();
      },
      listen: (port, host, callback) => {
        expect(port).toBe(0);
        expect(host).toBe('127.0.0.1');
        callback();
      },
      address: () => ({ address: '127.0.0.1', family: 'IPv4', port: 48_321 }),
      once: (event) => {
        expect(event).toBe('error');
        return fakeServer;
      },
    };

    await expect(findAvailablePort({ createTcpServer: () => fakeServer })).resolves.toBe(48_321);
    expect(closed).toBe(true);
  });
});
