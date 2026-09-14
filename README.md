# Sistema de Estacionamientos

Plataforma full-stack para administrar estacionamientos registrados, tickets con QR, reservas, pagos y cupos en tiempo real.

## Stack
- React + Vite (web y empaquetado móvil Android vía Capacitor)
- Node.js + Express
- PostgreSQL (con migraciones versionadas vía `node-pg-migrate`)
- Socket.IO (disponibilidad en tiempo real)
- Docker Compose
- Webpay Plus (Transbank) para pagos
- Nodemailer para recuperación de contraseña

## Roles
- **USUARIO**: busca estacionamientos y disponibilidad sin necesidad de iniciar sesión, puede reservar un cupo con solo un código.
- **CLIENTE**: opera su(s) estacionamiento(s), emite y cobra tickets, valida reservas, y ve un dashboard de tickets/ingresos.
- **ADMIN**: registra establecimientos, usuarios y define el cupo máximo aprobado.

## Regla de cupos
El cliente no puede modificar `cupo_maximo`. La API valida permisos y las operaciones de entrada/salida usan transacciones PostgreSQL con bloqueo de fila.

## Configuración
1. Copia `.env.example` a `.env` en la raíz del proyecto y define contraseñas/secretos propios.
2. Copia `backend/.env.example` a `backend/.env` (usado para desarrollo local fuera de Docker).
3. (Opcional) Configura `SMTP_*` en `backend/.env` para enviar correos reales de recuperación de contraseña; si se omite, el enlace queda registrado en los logs del backend.
4. (Opcional) Configura `WEBPAY_COMMERCE_CODE`/`WEBPAY_API_KEY` con credenciales reales de Transbank; si se omiten, se usa el ambiente de integración/pruebas público que Transbank publica para desarrolladores.

## Ejecutar
```bash
docker compose up --build
```

Web: http://localhost:5173
API: http://localhost:3000/health

Las migraciones se aplican automáticamente al iniciar el backend.

## Tests
Los tests de backend requieren una base de datos accesible; se ejecutan dentro del contenedor para evitar conflictos con un PostgreSQL nativo que pueda estar escuchando en el puerto 5432 del host:
```bash
docker exec estacionamientos-backend npm test
```

## Empaquetado móvil (Android)
Ver [`frontend/android`](frontend/android) — proyecto Capacitor ya generado. Para reconstruir el APK tras cambios:
```bash
cd frontend
npm run android:build
```
Requiere Android SDK y un JDK 17+ (`JAVA_HOME` apuntando a él).

> Los secretos incluidos en `.env.example` son solo placeholders para desarrollo/demo — nunca los uses en producción.
