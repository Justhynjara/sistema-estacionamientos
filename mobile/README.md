# Aplicación móvil

La app Android ya está generada dentro de [`frontend/android`](../frontend/android) usando Capacitor sobre el mismo frontend React. No requiere un backend adicional: consume la misma API Node/Express (configurable vía `VITE_API_URL`, ver `frontend/.env.mobile.example`).

Para reconstruir el APK: `cd frontend && npm run android:build`.
