import axios from 'axios';
export const API_ORIGIN=import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const api=axios.create({baseURL:`${API_ORIGIN}/api`});
api.interceptors.request.use(c=>{const t=localStorage.getItem('token'); if(t)c.headers.Authorization=`Bearer ${t}`; return c;});
api.interceptors.response.use(
  r=>r,
  err=>{
    if(err.response?.status===401 && localStorage.getItem('token')){
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);
