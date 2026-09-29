import axios from 'axios';
export const API_ORIGIN=import.meta.env.VITE_API_URL || 'http://localhost:3000';
// La sesión viaja en una cookie httpOnly que pone el propio servidor: el navegador la manda solo
// con withCredentials:true, y JavaScript nunca llega a verla ni a guardarla (a diferencia del
// token en localStorage de antes, que cualquier XSS podía leer y robar con un simple fetch).
export const api=axios.create({baseURL:`${API_ORIGIN}/api`, withCredentials:true});
api.interceptors.response.use(
  r=>r,
  err=>{
    if(err.response?.status===401) window.dispatchEvent(new Event('auth:logout'));
    return Promise.reject(err);
  }
);
