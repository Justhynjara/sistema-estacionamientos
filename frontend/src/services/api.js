import axios from 'axios';
import { Capacitor } from '@capacitor/core';
export const API_ORIGIN=import.meta.env.VITE_API_URL || 'http://localhost:3000';
// La sesión viaja en una cookie httpOnly que pone el propio servidor: el navegador la manda solo
// con withCredentials:true, y JavaScript nunca llega a verla ni a guardarla (a diferencia del
// token en localStorage de antes, que cualquier XSS podía leer y robar con un simple fetch).
export const api=axios.create({baseURL:`${API_ORIGIN}/api`, withCredentials:true});

// En la app nativa (iOS/Android) la web corre en capacitor://localhost o https://localhost y la
// API vive en otro dominio: el WebView de iOS bloquea esa cookie de terceros, así que el login
// "funcionaría" pero la siguiente petición llegaría sin sesión. Ahí se usa el token que el login
// ya devuelve en el cuerpo, enviado en el encabezado Authorization (la API lo acepta igual que la
// cookie). Se guarda solo en memoria, nunca en localStorage: al cerrar la app hay que volver a
// iniciar sesión, a cambio de que ningún script pueda leerlo desde el almacenamiento.
const esAppNativa=Capacitor.isNativePlatform();
let tokenNativo=null;

export function guardarSesionNativa(token){
  if(esAppNativa) tokenNativo=token || null;
}

api.interceptors.request.use(config=>{
  if(tokenNativo) config.headers.Authorization=`Bearer ${tokenNativo}`;
  return config;
});

api.interceptors.response.use(
  r=>r,
  err=>{
    if(err.response?.status===401){
      tokenNativo=null;
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);
