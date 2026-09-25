import { test, expect } from '@playwright/test';
import { crearEscenario } from './datos.js';

let esc;
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => { esc = await crearEscenario(); });
test.afterAll(async () => { await esc?.limpiar(); });

async function iniciarSesion(page, { email, password }) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Acceso Cliente / Admin' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('el dueño emite un ticket, el conductor ve su tiempo y monto con el QR, y el dueño cobra abriendo ese mismo enlace', async ({ page, browser }) => {
  // --- Dueño: entra y emite un ticket ---
  await iniciarSesion(page, esc.dueno);
  await expect(page.getByRole('heading', { name: esc.parking.nombre })).toBeVisible();

  page.once('dialog', d => d.accept('E2E123')); // prompt de la patente
  await page.getByRole('button', { name: /Emitir ticket/ }).click();
  await expect(page.getByText(/Ticket emitido en/)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible(); // el QR se dibuja

  const codigo = (await page.locator('p').filter({ hasText: /^[0-9a-f]{36}$/ }).first().innerText()).trim();

  // El vehículo lleva 90 minutos dentro (se adelanta la entrada en la base).
  await esc.db.query(`UPDATE tickets SET fecha_entrada = NOW() - interval '90 minutes' WHERE codigo_qr=$1`, [codigo]);

  // --- Conductor: escanea el QR con la cámara (sin sesión) ---
  const conductor = await browser.newContext();
  const vista = await conductor.newPage();
  await vista.goto(`/?ticket=${codigo}`);
  await expect(vista.getByLabel('Tiempo estacionado')).toHaveText(/^01:3\d:\d\d$/);
  // 90 min × $20 = $1.800 (o $1.820 si justo pasó un minuto más)
  await expect(vista.getByLabel('Monto a pagar')).toHaveText(/^\$1\.(800|820)$/);
  await expect(vista.getByText(/\$20\/min · mínimo \$500/)).toBeVisible();
  await expect(vista.getByRole('button', { name: /Soy el dueño/ })).toBeVisible();

  // --- Dueño con sesión: abre el mismo enlace y cae directo al cobro ---
  await page.goto(`/?ticket=${codigo}`);
  await expect(page.getByText(/Total a pagar: \$1\.(800|820)/)).toBeVisible();
  await expect(page).not.toHaveURL(/ticket=/); // el enlace se consumió
  await page.getByRole('button', { name: /Débito/ }).click();
  await page.getByRole('button', { name: /Confirmar cobro con Débito/ }).click();
  await expect(page.getByText(/Cobro registrado \(Débito\): \$1\.(800|820)/)).toBeVisible();

  // --- Conductor: al recargar ve que el ticket quedó cerrado y lo que pagó ---
  await vista.reload();
  await expect(vista.getByText(/pagaste \$1\.(800|820)/i)).toBeVisible();
  await conductor.close();

  // --- En la base: ticket cerrado y cupo devuelto ---
  const t = await esc.db.query('SELECT estado, monto, metodo_pago FROM tickets WHERE codigo_qr=$1', [codigo]);
  expect(t.rows[0].estado).toBe('CERRADO');
  expect(t.rows[0].metodo_pago).toBe('DEBITO');
  expect([1800, 1820]).toContain(Number(t.rows[0].monto));
  const cupos = await esc.db.query('SELECT cupos_disponibles FROM estacionamientos WHERE id=$1', [esc.parking.id]);
  expect(cupos.rows[0].cupos_disponibles).toBe(5);
});

test('un QR con un código que no existe avisa que no se encontró el ticket', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto('/?ticket=' + 'f'.repeat(36));
  await expect(p.getByText(/No encontramos este ticket/)).toBeVisible();
  await ctx.close();
});

test('el admin elimina un usuario desde el panel y queda auditado', async ({ page }) => {
  await iniciarSesion(page, esc.admin);
  const fila = page.getByRole('row').filter({ hasText: esc.victima.email });
  await expect(fila).toBeVisible();

  page.once('dialog', d => d.accept()); // confirmación de eliminar
  await page.getByRole('button', { name: `Eliminar a ${esc.victima.nombre}` }).click();
  await expect(fila).toHaveCount(0);

  const u = await esc.db.query('SELECT 1 FROM usuarios WHERE id=$1', [esc.victima.id]);
  expect(u.rowCount).toBe(0);
  const a = await esc.db.query(
    `SELECT detalle FROM audit_log WHERE accion='usuario.eliminar' AND entidad_id=$1 AND usuario_id=$2`,
    [esc.victima.id, esc.admin.id]
  );
  expect(a.rowCount).toBe(1);
  expect(a.rows[0].detalle.email).toBe(esc.victima.email);
});
