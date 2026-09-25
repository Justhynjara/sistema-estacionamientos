import { defineConfig } from '@playwright/test';

// Las pruebas levantan sus propios datos en la base y los borran al terminar. Se ejecutan contra
// una pila ya corriendo (web + API + Postgres): la local de `docker compose up`, o la que arma el
// workflow e2e.yml en GitHub. Variables:
//   E2E_BASE_URL      web (por defecto http://localhost:5173)
//   E2E_DATABASE_URL  Postgres de esa pila (por defecto el de docker compose local)
//   E2E_CHANNEL       navegador ya instalado (p. ej. "msedge" o "chrome"); vacío = Chromium de Playwright
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
