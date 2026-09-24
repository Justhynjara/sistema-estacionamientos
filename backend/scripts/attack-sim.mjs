#!/usr/bin/env node
// Simulación de ataque de "caja gris" — pensada para correr A MANO contra el sandbox local
// (docker compose), NUNCA contra producción. A diferencia de scripts/security-qa.mjs (que es
// un smoke test liviano pensado para correr cada 6h sin supervisión), este script intenta
// EXPLOTAR de verdad las superficies típicas de un atacante externo: inyección SQL, falsificación
// de JWT, IDOR, escalación de privilegios, bypass de rate-limit, XSS almacenado, condiciones de
// carrera. Crea usuarios/estacionamientos de prueba y satura el rate-limiter a propósito, por eso
// no está pensado para correr desatendido ni en CI.
//
// Uso:
//   docker compose up -d --build backend   (o que ya esté corriendo)
//   JWT_SECRET_SANDBOX=<el valor de JWT_SECRET en tu .env local> node backend/scripts/attack-sim.mjs
//
// JWT_SECRET_SANDBOX es opcional: sin él se saltan las 2 pruebas que necesitan el secreto real
// del sandbox (token expirado, y el control de "si el secreto se filtra, ¿escala?").

import jwt from 'jsonwebtoken';

const API = process.env.QA_API_URL || 'http://localhost:3000';
const results = [];

function record(categoria, nombre, ok, detalle = '') {
  results.push({ categoria, nombre, ok, detalle });
  console.log(`${ok ? '🛡️  BLOQUEADO' : '🚨 VULNERABLE'} [${categoria}] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

async function req(path, opts = {}) {
  const r = await fetch(`${API}${path}`, opts);
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body, headers: r.headers };
}

async function login(email, password) {
  const r = await req('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return r.body?.token;
}

async function main() {
  console.log(`\n=== Simulación de ataque contra sandbox: ${API} ===`);
  if (API.includes('onrender.com')) {
    console.error('\n❌ Este script crea usuarios de prueba y satura rate-limiters a propósito.');
    console.error('   No está pensado para correr contra producción. Usa QA_API_URL=http://localhost:3000');
    process.exit(1);
  }
  console.log('');

  const tokenCliente = await login('cliente@demo.cl', 'password');
  const tokenAdmin = await login('admin@demo.cl', 'password');
  const payloadCliente = jwt.decode(tokenCliente);

  // ---------- 1. Inyección SQL ----------
  console.log('--- 1. Inyección SQL ---');
  const sqliPayloads = ["' OR '1'='1' --", "'; DROP TABLE usuarios; --", "admin@demo.cl' --"];
  for (const p of sqliPayloads) {
    const r = await req('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: p, password: p })
    });
    // 400 = validación, 401 = credenciales inválidas, 429 = ni siquiera llegó a intentarlo.
    // Cualquiera de los tres cuenta como bloqueado; solo un 200-con-token sería la inyección funcionando.
    record('SQLi', `login con payload "${p}"`, r.status !== 200, `status ${r.status}`);
  }
  {
    const r = await req(`/api/tickets/reserva/${encodeURIComponent("x' OR '1'='1")}`);
    record('SQLi', 'path param codigo_qr con payload SQLi', r.status === 404, `status ${r.status}`);
  }
  {
    const t = await login('admin@demo.cl', 'password');
    record('SQLi', 'tabla usuarios íntegra tras intento de DROP TABLE', !!t, t ? 'login admin sigue funcionando' : 'login admin falló');
  }

  // ---------- 2. Falsificación de JWT ----------
  console.log('\n--- 2. Falsificación / manipulación de JWT ---');
  for (const secretDebil of ['dev_secret', 'secret', '123456', 'password', '']) {
    let forjado;
    try { forjado = jwt.sign({ ...payloadCliente, rol: 'ADMIN' }, secretDebil, { algorithm: 'HS256' }); }
    catch { continue; }
    const r = await req('/api/admin/users', { headers: { Authorization: `Bearer ${forjado}` } });
    record('JWT', `token forjado con secreto débil "${secretDebil || '(vacío)'}"`, r.status === 401, `status ${r.status}`);
  }
  {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ ...payloadCliente, rol: 'ADMIN' })).toString('base64url');
    const r = await req('/api/admin/users', { headers: { Authorization: `Bearer ${header}.${payload}.` } });
    record('JWT', 'ataque alg=none (token sin firma)', r.status === 401, `status ${r.status}`);
  }
  {
    const forjado = jwt.sign({ ...payloadCliente, rol: 'ADMIN' }, 'un-secreto-cualquiera-inventado', { algorithm: 'HS256' });
    const r = await req('/api/admin/users', { headers: { Authorization: `Bearer ${forjado}` } });
    record('JWT', 'token con firma de secreto arbitrario', r.status === 401, `status ${r.status}`);
  }
  {
    const secretLocal = process.env.JWT_SECRET_SANDBOX;
    if (secretLocal && payloadCliente) {
      const { exp, iat, ...sinFechas } = payloadCliente;
      const expirado = jwt.sign(sinFechas, secretLocal, { algorithm: 'HS256', expiresIn: -10 });
      const r = await req('/api/tickets/active', { headers: { Authorization: `Bearer ${expirado}` } });
      record('JWT', 'token expirado', r.status === 401, `status ${r.status}`);

      const forjadoConSecretoReal = jwt.sign({ ...sinFechas, rol: 'ADMIN' }, secretLocal, { algorithm: 'HS256' });
      const r2 = await req('/api/admin/users', { headers: { Authorization: `Bearer ${forjadoConSecretoReal}` } });
      record('JWT (control)', 'si JWT_SECRET se filtrara, un token forjado escalaría', r2.status !== 200,
        r2.status === 200 ? 'CONFIRMA que proteger JWT_SECRET es crítico: con el secreto real, cualquiera forja un ADMIN' : `status ${r2.status}`);
    } else {
      console.log('   (sin JWT_SECRET_SANDBOX: se saltan "token expirado" y el control de fuga de secreto)');
    }
  }

  // ---------- 3. IDOR / control de acceso ----------
  console.log('\n--- 3. IDOR y control de acceso entre roles ---');
  const attackerEmail = `atacante_${Date.now()}@evil.test`;
  await req('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Atacante', email: attackerEmail, password: 'atacante123' })
  });
  const tokenAtacante = await login(attackerEmail, 'atacante123');
  {
    const r = await req('/api/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAtacante}` },
      body: JSON.stringify({ estacionamiento_id: '11111111-1111-4111-8111-111111111111' })
    });
    record('IDOR/roles', 'usuario rol USUARIO no puede emitir tickets (requiere CLIENTE)', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await req('/api/admin/users', { headers: { Authorization: `Bearer ${tokenAtacante}` } });
    record('IDOR/roles', 'usuario rol USUARIO no puede listar usuarios (admin)', r.status === 403, `status ${r.status}`);
  }
  {
    const r = await req('/api/admin/params/reserva_monto_clp', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAtacante}` },
      body: JSON.stringify({ valor: '1' })
    });
    record('IDOR/roles', 'usuario rol USUARIO no puede bajar el monto de la reserva a $1', r.status === 403, `status ${r.status}`);
  }

  // ---------- 4. Escalación de privilegios (regresión) ----------
  console.log('\n--- 4. Escalación de privilegios vía registro público ---');
  {
    const email2 = `atacante2_${Date.now()}@evil.test`;
    const r = await req('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Atacante2', email: email2, password: 'atacante123', rol: 'ADMIN' })
    });
    record('Privesc', 'registro público con rol=ADMIN es ignorado', r.body?.rol === 'USUARIO', `rol devuelto: ${r.body?.rol}`);
  }

  // ---------- 5. XSS / abuso de subida de fotos ----------
  console.log('\n--- 5. XSS almacenado y abuso de subida de fotos en "quiero ser cliente" ---');
  {
    const payloadXSS = '<img src=x onerror=alert(1)>';
    const r = await req('/api/solicitudes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_solicitante: payloadXSS, email: 'xss@evil.test', nombre_establecimiento: payloadXSS,
        direccion: 'Calle Falsa 123', precio_minuto: 20, tarifa_minima: 500, cupo_estimado: 5, descripcion: payloadXSS
      })
    });
    record('XSS', 'guarda el payload tal cual (React lo escapa al renderizar; no es XSS ejecutable)', r.status === 201, `status ${r.status}`);
  }
  {
    const r = await req('/api/solicitudes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_solicitante: 'Test Foto', email: 'foto@evil.test', nombre_establecimiento: 'Test',
        direccion: 'Calle Falsa 123', precio_minuto: 20, tarifa_minima: 500, cupo_estimado: 5,
        fotos: ['data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==']
      })
    });
    record('Upload', 'rechaza data URI con mimetype no permitido (SVG puede traer <script>)', r.status === 400, `status ${r.status}`);
  }

  // ---------- 6. Condición de carrera: doble reserva del mismo cupo ----------
  console.log('\n--- 6. Condición de carrera: reservar el mismo último cupo en paralelo ---');
  {
    const meCliente = await req('/api/auth/me', { headers: { Authorization: `Bearer ${tokenCliente}` } });
    const crea = await req('/api/admin/parking', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ cliente_id: meCliente.body.id, nombre: 'Race Test', direccion: 'Test', latitud: -33.4, longitud: -70.6, precio_minuto: 20, tarifa_minima: 500, cupo_maximo: 1 })
    });
    const parkingId = crea.body?.id;
    if (parkingId) {
      const intentos = await Promise.all(Array.from({ length: 5 }, () =>
        req('/api/tickets/reserve', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCliente}` },
          body: JSON.stringify({ estacionamiento_id: parkingId })
        })
      ));
      const exitosas = intentos.filter(r => r.status === 201).length;
      record('Race condition', '5 reservas simultáneas sobre 1 solo cupo → solo 1 debe ganar', exitosas === 1, `${exitosas}/5 reservas exitosas (esperado: 1)`);
    } else {
      record('Race condition', 'no se pudo crear el estacionamiento de prueba', false, JSON.stringify(crea.body));
    }
  }

  // ---------- 7. Bypass de rate-limit falsificando la IP ----------
  console.log('\n--- 7. Bypass de rate-limit falsificando X-Forwarded-For ---');
  {
    const intentos = [];
    for (let i = 0; i < 15; i++) {
      const r = await req('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${i}.${i}` },
        body: JSON.stringify({ email: 'no-existe@demo.cl', password: 'x' })
      });
      intentos.push(r.status);
    }
    const bloqueados = intentos.filter(s => s === 429).length;
    // En local no hay Cloudflare real, así que esta prueba "falla" a propósito aquí: sin
    // CF-Connecting-IP de por medio, cae al req.ip normal de Express, que sigue leyendo
    // X-Forwarded-For por el trust proxy. En producción (con Cloudflare real delante) el
    // key generator usa CF-Connecting-IP, que el cliente no puede falsificar. Ver prueba 7b.
    record('Rate-limit', 'rotar X-Forwarded-For evita el límite (sin Cloudflare real de por medio, como en local)', bloqueados > 0,
      `${bloqueados}/15 bloqueados con 429`);
  }
  {
    // Simula lo que pasaría con Cloudflare real delante: CF-Connecting-IP fijo (Cloudflare
    // identificó siempre la misma conexión) aunque el cliente rote X-Forwarded-For.
    const intentos = [];
    for (let i = 0; i < 12; i++) {
      const r = await req('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${i}.${i}`, 'CF-Connecting-IP': '200.1.2.3' },
        body: JSON.stringify({ email: 'no-existe@demo.cl', password: 'x' })
      });
      intentos.push(r.status);
    }
    const bloqueados = intentos.filter(s => s === 429).length;
    record('Rate-limit', 'con CF-Connecting-IP fijo (simulando Cloudflare real), rotar X-Forwarded-For ya NO evade el límite', bloqueados > 0, `${bloqueados}/12 bloqueados con 429`);
  }

  console.log('\n=== RESUMEN ===');
  const vulnerables = results.filter(r => !r.ok);
  console.log(`${results.length - vulnerables.length}/${results.length} pruebas de ataque bloqueadas correctamente`);
  if (vulnerables.length) {
    console.log('\n🚨 Hallazgos que requieren atención:');
    vulnerables.forEach(v => console.log(`- [${v.categoria}] ${v.nombre}: ${v.detalle}`));
  }
}

main().catch(e => { console.error('Error en la simulación:', e); process.exit(1); });
