const { spawn } = require('child_process');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 8000;
const BASE_URL = `http://${HOST}:${PORT}`;

let phpServer;

beforeAll(async () => {
  const docRoot = path.resolve(__dirname, '..');
  phpServer = spawn('php', ['-S', `${HOST}:${PORT}`, '-t', docRoot], {
    stdio: 'ignore',
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));
});

afterAll(() => {
  if (phpServer) {
    phpServer.kill();
  }
});

describe('LAMPAPI integration tests', () => {
  test('POST /LAMPAPI/AddColor.php responds to JSON payload', async () => {
    const response = await fetch(`${BASE_URL}/LAMPAPI/AddColor.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        color: 'Electric Blue',
        userId: '1',
      }),
    });

    const rawText = await response.text();

    if (process.env.CI) {
      expect(response.status).toBe(200);
      const data = JSON.parse(rawText);
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('');
    } else {
      // Locally without mysqli extension / MySQL service, PHP server still responds
      expect([200, 500]).toContain(response.status);
    }
  });
});
