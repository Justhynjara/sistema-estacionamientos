# Aplicación móvil

La app Android ya está generada dentro de [`frontend/android`](../frontend/android) usando Capacitor sobre el mismo frontend React. No requiere un backend adicional: consume la misma API Node/Express (configurable vía `VITE_API_URL`, ver `frontend/.env.mobile.example`).

Para reconstruir el APK: `cd frontend && npm run android:build`.

## iOS (iPhone)

El proyecto iOS está en [`frontend/ios`](../frontend/ios) (Capacitor 8, Swift Package Manager). Compilarlo requiere macOS con Xcode; sin Mac se usa [Codemagic](https://codemagic.io) con el flujo `ios-unsigned-ipa` de [`codemagic.yaml`](../codemagic.yaml), que genera `Estacionamientos-unsigned.ipa` apuntando a la API de producción.

Instalar en un iPhone sin cuenta de Apple Developer:

1. Conecta tu repositorio de GitHub en Codemagic y ejecuta el flujo **iOS - IPA sin firma**. Descarga el `.ipa` de los artefactos.
2. En Windows, instala [Sideloadly](https://sideloadly.io) e iTunes (versión de apple.com, no la de Microsoft Store).
3. Conecta el iPhone por cable, abre Sideloadly, arrastra el `.ipa` y entra con tu Apple ID.
4. En el iPhone: Ajustes → General → VPN y gestión de dispositivos → confía en tu Apple ID. En iOS 16 o superior, activa también Ajustes → Privacidad y seguridad → **Modo de desarrollador** (pide reiniciar).

Con un Apple ID gratuito la app deja de abrir a los 7 días: vuelve a instalarla con Sideloadly. Para distribuirla sin ese límite (TestFlight o App Store) se necesita una cuenta de Apple Developer (US$99 al año).

En la app nativa la sesión de dueños y administradores se guarda solo mientras la app está abierta: al cerrarla, hay que volver a iniciar sesión.
