import { z } from 'zod';

// Zod 4 trae sus mensajes por defecto en inglés ("Invalid input: expected string..."). La web casi
// siempre los traduce, pero la app móvil y cualquier otro cliente de la API los recibían tal cual.
z.config(z.locales.es());
