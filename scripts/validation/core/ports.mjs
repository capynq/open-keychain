import { createServer } from 'node:net';

export const findAvailablePort = ({ host = '127.0.0.1', createTcpServer = createServer } = {}) =>
  new Promise((resolve, reject) => {
    const server = createTcpServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('The operating system did not return an available TCP port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
