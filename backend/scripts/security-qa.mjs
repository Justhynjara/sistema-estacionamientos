#!/usr/bin/env node
// QA de seguridad automatizado: pruebas de caja negra contra una API en vivo.
// Pensado para correr cada 6h vía GitHub Actions (.github/workflows/security-qa.yml),
// pero también se puede correr a mano: QA_API_URL=http://localhost:3000 node scripts/security-qa.mjs

const API = process.env.QA_API_URL || 'https://estacionamientos-api.onrender.com';
// admin@demo.cl/password son credenciales demo públicas (ver README), no un secreto real.
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'admin@demo.cl';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || 'password';
const TIMEOUT_MS = 60_000; // Render free tier puede tardar en despertar

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(path, opts = {}) {
  return fetch(`${API}${path}`, { ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function check(name, fn) {
  try { await fn(); }
  catch (e) { record(name, false, e.message); }
}

async function main() {
  console.log(`QA de seguridad contra ${API}\n`);

  await check('API responde /health', async () => {
    const r = await req('/health');
    record('API responde /health', r.ok, `status ${r.status}`);
  });

  await check('Cabeceras de seguridad (helmet)', async () => {
    const r = await req('/health');
    const csp = r.headers.get('content-security-policy');
    const hsts = r.headers.get('strict-transport-security');
    const xcto = r.headers.get('x-content-type-options');
    record('Cabeceras de seguridad presentes (CSP/HSTS/X-Content-Type-Options)', !!csp && !!hsts && xcto === 'nosniff');
  });

  await check('CORS rechaza origen no permitido', async () => {
    const r = await req('/api/parking', { headers: { Origin: 'https://evil-qa-test.example' } });
    record('CORS rechaza origen no permitido', r.status === 403, `status ${r.status}`);
  });

  await check('/admin/users exige autenticación', async () => {
    const r = await req('/api/admin/users');
    record('/admin/users exige autenticación', r.status === 401, `status ${r.status}`);
  });

  await check('/tickets/active exige autenticación', async () => {
    const r = await req('/api/tickets/active');
    record('/tickets/active exige autenticación', r.status === 401, `status ${r.status}`);
  });

  await check('SQLi básico no rompe /parking/nearby', async () => {
    const r = await req(`/api/parking/nearby?lat=-33.45&lng=${encodeURIComponent("-70.66' OR '1'='1")}`);
    record('Parámetro no numérico en /parking/nearby es rechazado (400), no 500', r.status === 400, `status ${r.status}`);
  });

  // Regresión del fix crítico: registro público NO debe poder autoasignarse un rol privilegiado.
  let createdUserId = null;
  const testEmail = `qa-auto-${Date.now()}@security-test.local`;
  await check('Registro público ignora rol=ADMIN', async () => {
    const r = await req('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'QA Automation', email: testEmail, password: 'password123', rol: 'ADMIN' })
    });
    const body = await safeJson(r);
    createdUserId = body?.id || null;
    record('Registro público ignora rol=ADMIN (fuerza USUARIO)', r.status === 201 && body?.rol === 'USUARIO', `status ${r.status}, rol=${body?.rol}`);
  });

  let adminToken = null;
  await check('Login de la cuenta admin de control', async () => {
    const r = await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const body = await safeJson(r);
    adminToken = body?.token || null;
    record('Login admin de control funciona', r.status === 200 && !!adminToken, `status ${r.status}`);
  });

  if (adminToken) {
    await check('Allowlist de parámetros rechaza clave desconocida', async () => {
      const r = await req('/api/admin/params/clave_inventada_qa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ valor: '999' })
      });
      record('Allowlist de parámetros rechaza clave desconocida', r.status === 400, `status ${r.status}`);
    });

    if (createdUserId) {
      await check('Limpieza: desactivar cuenta de prueba', async () => {
        const r = await req(`/api/admin/users/${createdUserId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ activo: false })
        });
        record('Cuenta de prueba desactivada tras el chequeo', r.status === 200, `status ${r.status}`);
      });
    }
  } else {
    record('Allowlist de parámetros rechaza clave desconocida', false, 'sin token admin (login falló)');
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificaciones OK`);
  if (failed.length) {
    console.log('\nFallas detectadas:');
    for (const f of failed) console.log(`- ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exitCode = 1;
  }
}

main();
