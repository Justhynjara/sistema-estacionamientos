#!/usr/bin/env node
// QA de seguridad automatizado: pruebas de caja negra contra una API en vivo.
// Pensado para correr cada 6h vía GitHub Actions (.github/workflows/security-qa.yml),
// pero también se puede correr a mano: QA_API_URL=http://localhost:3000 node scripts/security-qa.mjs
//
// Reglas de estas pruebas, porque corren contra producción:
// - Nada de carga ni fuerza bruta: cada chequeo hace una o dos peticiones.
// - El límite de /api/auth es de 10 intentos por IP cada 15 min y lo comparten login, registro y
//   recuperación de clave; este script usa como máximo 8 en total.
// - Todo lo que crea (una cuenta qa-auto-…) lo borra al final, falle lo que falle.

const API = process.env.QA_API_URL || 'https://estacionamientos-api.onrender.com';
// admin@demo.cl/password son credenciales demo públicas (ver README), no un secreto real.
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'admin@demo.cl';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || 'password';
const TIMEOUT_MS = 60_000; // Render free tier puede tardar en despertar
const REINTENTOS = 2;      // reintentos extra ante timeout o error de red (solo peticiones de lectura)
const ES_HTTPS = API.startsWith('https://');

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

// En el plan free de Render la instancia se duerme tras inactividad y puede tardar en responder o
// reiniciarse a mitad de la corrida. Las lecturas (GET/HEAD) se reintentan ante timeout o error de
// red: así una API fría no se confunde con una caída. Las escrituras no se reintentan, para no
// duplicar efectos (por ejemplo, registrar dos cuentas).
async function req(path, opts = {}) {
  const metodo = (opts.method || 'GET').toUpperCase();
  const intentos = metodo === 'GET' || metodo === 'HEAD' ? 1 + REINTENTOS : 1;
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fetch(`${API}${path}`, { redirect: 'manual', ...opts, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) await esperar(5_000);
    }
  }
  throw ultimoError;
}

const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const bearer = token => ({ headers: { Authorization: `Bearer ${token}` } });

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function check(name, fn) {
  try { await fn(); }
  catch (e) { record(name, false, e.message); }
}

// Una respuesta de error no debe dejar ver trazas internas (rutas de archivos, stack de Node).
function filtraInternos(texto) {
  return /node_modules|at [\w.<>]+ \(|\/app\/src|Error: .*\n\s+at /.test(texto || '');
}

async function main() {
  console.log(`QA de seguridad contra ${API}\n`);

  await check('API responde /health', async () => {
    const r = await req('/health');
    record('API responde /health', r.ok, `status ${r.status}`);
  });

  // ---------- Cabeceras y transporte ----------
  await check('Cabeceras de seguridad', async () => {
    const r = await req('/health');
    const h = n => r.headers.get(n);
    record('Cabeceras de seguridad presentes (CSP/HSTS/X-Content-Type-Options)', !!h('content-security-policy') && !!h('strict-transport-security') && h('x-content-type-options') === 'nosniff');
    const csp = h('content-security-policy') || '';
    record('La API no se puede incrustar en un iframe ajeno (X-Frame-Options o frame-ancestors)', !!h('x-frame-options') || /frame-ancestors/.test(csp), `x-frame-options=${h('x-frame-options')}`);
    record('No anuncia la tecnología del servidor (sin X-Powered-By)', !h('x-powered-by'), `x-powered-by=${h('x-powered-by')}`);
    record('Referrer-Policy y Permissions-Policy presentes', !!h('referrer-policy') && !!h('permissions-policy'));
  });

  await check('CORS rechaza origen no permitido', async () => {
    const r = await req('/api/parking', { headers: { Origin: 'https://evil-qa-test.example' } });
    record('CORS rechaza origen no permitido', r.status === 403 && !r.headers.get('access-control-allow-origin'), `status ${r.status}`);
  });

  // ---------- Rutas privadas sin sesión ----------
  for (const ruta of ['/api/admin/users', '/api/admin/audit-log', '/api/tickets/active', '/api/parking/mine', '/api/solicitudes']) {
    await check(`${ruta} exige autenticación`, async () => {
      const r = await req(ruta);
      record(`${ruta} exige autenticación`, r.status === 401, `status ${r.status}`);
    });
  }

  // ---------- Tokens falsificados ----------
  await check('Tokens falsificados', async () => {
    const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const payload = { id: '00000000-0000-4000-8000-000000000000', email: 'qa@security-test.local', rol: 'ADMIN' };
    const casos = {
      'sin firma (alg "none")': `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`,
      'con firma inventada': `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.${Buffer.from('firma-falsa-qa').toString('base64url')}`,
      'basura': 'esto-no-es-un-jwt'
    };
    for (const [caso, token] of Object.entries(casos)) {
      const r = await req('/api/admin/users', bearer(token));
      record(`Token ${caso} rechazado en /admin/users`, r.status === 401, `status ${r.status}`);
    }
  });

  // ---------- Entradas maliciosas ----------
  await check('SQLi básico no rompe /parking/nearby', async () => {
    const r = await req(`/api/parking/nearby?lat=-33.45&lng=${encodeURIComponent("-70.66' OR '1'='1")}`);
    record('Parámetro no numérico en /parking/nearby es rechazado (400), no 500', r.status === 400, `status ${r.status}`);
  });
  for (const [base, valor] of [['/api/parking', "1' OR '1'='1"], ['/api/tickets/publico', "x' UNION SELECT 1--"]]) {
    await check(`Inyección en ${base}/:id`, async () => {
      const r = await req(`${base}/${encodeURIComponent(valor)}`);
      const texto = await r.text();
      record(`Identificador con inyección SQL en ${base}/:id se rechaza (400/404) sin error interno`,
        (r.status === 400 || r.status === 404) && !filtraInternos(texto), `status ${r.status}`);
    });
  }

  await check('JSON malformado', async () => {
    const r = await req('/api/parking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"nombre": "sin cerrar' });
    const texto = await r.text();
    record('JSON malformado responde 400 sin filtrar trazas internas', r.status === 400 && !filtraInternos(texto), `status ${r.status}`);
  });

  await check('Ruta inexistente', async () => {
    const r = await req('/api/no-existe-qa');
    const texto = await r.text();
    record('Ruta inexistente responde 404 sin filtrar trazas internas', r.status === 404 && !filtraInternos(texto), `status ${r.status}`);
  });

  await check('Ticket público inexistente', async () => {
    const r = await req('/api/tickets/publico/00000000-0000-4000-8000-000000000000');
    record('Ticket público con un código que no existe responde 404', r.status === 404, `status ${r.status}`);
  });

  await check('Retorno de Webpay con token falso', async () => {
    const r = await req('/api/payments/webpay/return?token_ws=token-falso-qa-security');
    const destino = r.headers.get('location') || '';
    record('Un token de Webpay inventado no confirma ningún pago (redirige a pago=error)', r.status >= 300 && r.status < 400 && /pago=error/.test(destino), `status ${r.status}, location=${destino.replace(/^https?:\/\/[^/]+/, '')}`);
  });

  // ---------- Registro, sesión y privilegios (cuenta de prueba propia) ----------
  // Intentos contra /api/auth en este bloque: registro (1) + login correcto (1) + login con clave
  // errónea (1) + login de email inexistente (1) = 4. Con las 3 cuentas demo y el admin: 8.
  let createdUserId = null;
  let tokenUsuario = null;
  const testEmail = `qa-auto-${Date.now()}@security-test.local`;
  const testPassword = `qa-${Math.random().toString(36).slice(2)}-Clave9`;

  await check('Registro público ignora rol=ADMIN', async () => {
    const r = await req('/api/auth/register', json({ nombre: 'QA Automation', email: testEmail, password: testPassword, rol: 'ADMIN' }));
    const body = await safeJson(r);
    createdUserId = body?.id || null;
    record('Registro público ignora rol=ADMIN (fuerza USUARIO)', r.status === 201 && body?.rol === 'USUARIO', `status ${r.status}, rol=${body?.rol}`);
  });

  if (createdUserId) {
    await check('Login de la cuenta de prueba', async () => {
      const r = await req('/api/auth/login', json({ email: testEmail, password: testPassword }));
      const body = await safeJson(r);
      tokenUsuario = body?.token || null;
      record('Login de la cuenta de prueba funciona', r.status === 200 && !!tokenUsuario, `status ${r.status}`);

      const cookie = r.headers.get('set-cookie') || '';
      const banderas = /httponly/i.test(cookie) && (!ES_HTTPS || (/;\s*secure/i.test(cookie) && /samesite=none/i.test(cookie)));
      record(`Cookie de sesión con HttpOnly${ES_HTTPS ? ', Secure y SameSite=None' : ''}`, banderas, cookie ? '' : 'sin Set-Cookie');
      const conLimite = !!(r.headers.get('ratelimit-limit') || r.headers.get('ratelimit-policy') || r.headers.get('ratelimit'));
      record('El login informa su límite de intentos (cabeceras RateLimit)', conLimite);
    });

    await check('Sin enumeración de cuentas', async () => {
      const malaClave = await req('/api/auth/login', json({ email: testEmail, password: 'clave-equivocada-qa' }));
      const noExiste = await req('/api/auth/login', json({ email: `no-existe-${Date.now()}@security-test.local`, password: 'clave-equivocada-qa' }));
      const [a, b] = [await safeJson(malaClave), await safeJson(noExiste)];
      record('El login responde igual con clave errónea que con email inexistente (no revela qué cuentas existen)',
        malaClave.status === 401 && noExiste.status === 401 && a?.error === b?.error, `status ${malaClave.status}/${noExiste.status}`);
    });
  }

  if (tokenUsuario) {
    for (const [nombre, ruta, opts] of [
      ['ver la lista de usuarios', '/api/admin/users', {}],
      ['ver el registro de auditoría', '/api/admin/audit-log', {}],
      ['ver los tickets de un dueño', '/api/tickets/active', {}],
      ['autoasignarse el rol ADMIN', `/api/admin/users/${createdUserId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rol: 'ADMIN' }) }]
    ]) {
      await check(`Escalada: ${nombre}`, async () => {
        const r = await req(ruta, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${tokenUsuario}` } });
        record(`Una cuenta USUARIO no puede ${nombre} (403)`, r.status === 403, `status ${r.status}`);
      });
    }
  }

  // Las cuentas de ejemplo del repositorio (clave pública "password") no deben abrir sesión en
  // producción. Solo se exige cuando el QA ya usa su propia cuenta admin (secretos configurados);
  // mientras siga usando la demo como control, no tiene sentido pedir que esté cerrada.
  if (ADMIN_EMAIL !== 'admin@demo.cl') {
    for (const email of ['admin@demo.cl', 'cliente@demo.cl', 'soporte@demo.cl']) {
      await check(`Cuenta demo ${email} cerrada`, async () => {
        const r = await req('/api/auth/login', json({ email, password: 'password' }));
        record(`La cuenta demo ${email} no permite iniciar sesión con la clave pública`, r.status !== 200, `status ${r.status}`);
      });
    }
  }

  let adminToken = null;
  await check('Login de la cuenta admin de control', async () => {
    const r = await req('/api/auth/login', json({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
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

    // Limpieza: esta prueba registra una cuenta cada vez que corre (cada 6 h y en cada push), así
    // que se elimina al terminar y, de paso, se barren las que hayan quedado de corridas anteriores
    // (solo las que siguen el patrón exacto de las cuentas de esta prueba).
    await check('Limpieza: eliminar cuentas de prueba', async () => {
      const auth = { Authorization: `Bearer ${adminToken}` };
      const lista = await req('/api/admin/users', { headers: auth });
      const usuarios = (await safeJson(lista)) || [];
      const esDePrueba = u => /^qa-auto-\d+@security-test\.local$/.test(u.email);
      const ids = new Set((Array.isArray(usuarios) ? usuarios : []).filter(esDePrueba).map(u => u.id));
      if (createdUserId) ids.add(createdUserId);

      let borradas = 0;
      for (const id of ids) {
        const r = await req(`/api/admin/users/${id}`, { method: 'DELETE', headers: auth });
        if (r.status === 200) borradas++;
      }
      record('Cuentas de prueba eliminadas tras el chequeo', borradas === ids.size, `${borradas}/${ids.size} eliminadas`);
    });

    // Con la cuenta ya eliminada, su token (todavía vigente por 8 h) no debe seguir sirviendo.
    if (tokenUsuario && createdUserId) {
      await check('Revocación de sesión', async () => {
        const r = await req('/api/tickets/active', bearer(tokenUsuario));
        record('El token de una cuenta eliminada deja de funcionar al instante (401)', r.status === 401, `status ${r.status}`);
      });
    }
  } else {
    record('Allowlist de parámetros rechaza clave desconocida', false, 'sin token admin (login falló)');
    if (createdUserId) {
      record('Cuentas de prueba eliminadas tras el chequeo', false,
        `sin token admin no se pudo borrar ${testEmail}; la próxima corrida con login admin la elimina`);
    }
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
