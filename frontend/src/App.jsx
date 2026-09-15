import {useEffect,useState} from 'react';
import {api} from './services/api.js';
import AdminPanel from './AdminPanel.jsx';
import ClientePanel from './ClientePanel.jsx';
import BuscarCercanos from './BuscarCercanos.jsx';
import ChatBot from './ChatBot.jsx';
import SolicitudClienteForm from './SolicitudClienteForm.jsx';
import SoportePanel from './SoportePanel.jsx';

function Login({onLogin,onCancel,onForgot}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  async function submit(e){
    e.preventDefault();
    setLoading(true);
    try{const r=await api.post('/auth/login',{email,password});localStorage.setItem('token',r.data.token);onLogin(r.data.user)}
    catch{alert('Credenciales inválidas')}
    finally{setLoading(false)}
  }
  return <div className="login-shell"><div className="card login-card">
    <div style={{fontSize:'2.2rem'}}>🅿️</div>
    <h1>Acceso Cliente / Administrador</h1>
    <p>Solo dueños de estacionamientos y administradores necesitan iniciar sesión.</p>
    <form onSubmit={submit}>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" aria-label="Email"/>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" aria-label="Contraseña"/>
      <button disabled={loading}>{loading && <span className="spinner"/>}{loading?'Ingresando...':'Iniciar sesión'}</button>
    </form>
    <button type="button" onClick={onForgot} className="link-button">¿Olvidaste tu contraseña?</button>
    <p>Demo cliente (dueño): cliente@demo.cl / password</p>
    <p>Demo administrador: admin@demo.cl / password</p>
    <p>Demo soporte: soporte@demo.cl / password</p>
    <button type="button" onClick={onCancel} className="link-button">← Volver a la búsqueda</button>
  </div></div>
}

function ForgotPassword({onBack}){
  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(false);
  const [mensaje,setMensaje]=useState('');
  async function submit(e){
    e.preventDefault();
    setLoading(true);
    try{
      const r=await api.post('/auth/forgot-password',{email});
      setMensaje(r.data.mensaje);
    }catch(err){ setMensaje(err.response?.data?.error || 'Ocurrió un error, intenta más tarde'); }
    finally{ setLoading(false); }
  }
  return <div className="login-shell"><div className="card login-card">
    <h1>Recuperar contraseña</h1>
    <p>Ingresa tu email y te enviaremos un enlace para definir una nueva contraseña.</p>
    {mensaje
      ? <p className="badge ok">{mensaje}</p>
      : <form onSubmit={submit}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" aria-label="Email" required/>
          <button disabled={loading}>{loading && <span className="spinner"/>}{loading?'Enviando...':'Enviar enlace'}</button>
        </form>}
    <button type="button" onClick={onBack} className="link-button">← Volver al inicio de sesión</button>
  </div></div>
}

function ResetPassword({token,onDone}){
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [mensaje,setMensaje]=useState('');
  const [error,setError]=useState('');
  async function submit(e){
    e.preventDefault();
    setLoading(true); setError('');
    try{
      const r=await api.post('/auth/reset-password',{token,password});
      setMensaje(r.data.mensaje);
    }catch(err){ setError(err.response?.data?.error || 'No se pudo actualizar la contraseña'); }
    finally{ setLoading(false); }
  }
  return <div className="login-shell"><div className="card login-card">
    <h1>Definir nueva contraseña</h1>
    {mensaje
      ? <>
          <p className="badge ok">{mensaje}</p>
          <button type="button" onClick={onDone}>Ir a iniciar sesión</button>
        </>
      : <form onSubmit={submit}>
          {error && <p className="badge off">{error}</p>}
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva contraseña (mín. 8 caracteres)" aria-label="Nueva contraseña" required minLength={8}/>
          <button disabled={loading}>{loading && <span className="spinner"/>}{loading?'Guardando...':'Guardar contraseña'}</button>
        </form>}
  </div></div>
}

function PagoBanner({estado,monto,onClose}){
  if(!estado) return null;
  const textos={
    aprobado:{cls:'ok',texto:`✅ Pago aprobado${monto?` por $${Number(monto).toLocaleString('es-CL')}`:''}.`},
    rechazado:{cls:'off',texto:'❌ El pago fue rechazado. Intenta con otra tarjeta.'},
    cancelado:{cls:'off',texto:'⚠️ Pago cancelado.'},
    sin_cupo:{cls:'off',texto:'⚠️ Tu pago se procesó, pero el cupo se agotó justo antes de confirmar tu reserva. Contacta al estacionamiento para resolverlo.'},
    error:{cls:'off',texto:'⚠️ Ocurrió un error al confirmar el pago.'}
  };
  const info=textos[estado];
  if(!info) return null;
  return <div className="container" style={{paddingBottom:0}}>
    <p className={'badge '+info.cls} style={{cursor:'pointer'}} onClick={onClose} title="Cerrar">{info.texto} ✕</p>
  </div>;
}

function App(){
 const [user,setUser]=useState(null);
 const [checkingSession,setCheckingSession]=useState(true);
 const [showLogin,setShowLogin]=useState(false);
 const [authView,setAuthView]=useState('login');
 const [resetToken,setResetToken]=useState(null);
 const [pago,setPago]=useState(null);
 const [reservaCodigo,setReservaCodigo]=useState(null);
 const [mostrarSolicitud,setMostrarSolicitud]=useState(false);

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const reset=params.get('reset');
   const pagoEstado=params.get('pago');
   const reserva=params.get('reserva');
   if(reset) setResetToken(reset);
   if(pagoEstado) setPago({estado:pagoEstado, monto:params.get('monto')});
   if(reserva) setReservaCodigo(reserva);
   if(reset || pagoEstado || reserva){
     const url=new URL(window.location.href);
     url.search='';
     window.history.replaceState({},'',url);
   }
 },[]);

 useEffect(()=>{
   const token=localStorage.getItem('token');
   if(!token){ setCheckingSession(false); return; }
   api.get('/auth/me')
     .then(r=>setUser(r.data))
     .catch(()=>localStorage.removeItem('token'))
     .finally(()=>setCheckingSession(false));
 },[]);

 useEffect(()=>{
   const onLogout=()=>setUser(null);
   window.addEventListener('auth:logout',onLogout);
   return ()=>window.removeEventListener('auth:logout',onLogout);
 },[]);

 if(checkingSession) return <div className="login-shell"><p><span className="spinner" style={{borderTopColor:'var(--primary)',borderColor:'rgba(67,56,202,.2)'}}/>Cargando sesión…</p></div>;

 if(resetToken){
   return <ResetPassword token={resetToken} onDone={()=>{setResetToken(null); setShowLogin(true); setAuthView('login');}}/>;
 }

 if(mostrarSolicitud){
   return <>
     <nav>
       <div className="brand"><span className="logo">🅿️</span> Sistema de Estacionamientos</div>
     </nav>
     <main className="container">
       <SolicitudClienteForm onCerrar={()=>setMostrarSolicitud(false)}/>
     </main>
   </>;
 }

 if(!user && showLogin){
   if(authView==='forgot') return <ForgotPassword onBack={()=>setAuthView('login')}/>;
   return <Login onLogin={u=>{setUser(u);setShowLogin(false);}} onCancel={()=>setShowLogin(false)} onForgot={()=>setAuthView('forgot')}/>;
 }

 if(!user){
   return <>
     <nav>
       <div className="brand"><span className="logo">🅿️</span> Sistema de Estacionamientos</div>
       <button onClick={()=>{setShowLogin(true);setAuthView('login');}}>Acceso Cliente / Admin</button>
     </nav>
     <PagoBanner estado={pago?.estado} monto={pago?.monto} onClose={()=>setPago(null)}/>
     <main className="container">
       <div className="hero">
         <h1>Encuentra estacionamiento cerca de tu destino</h1>
         <p>Sin registro, sin espera: ubica cupos disponibles y traza tu ruta en segundos.</p>
       </div>
       <div className="landing-choice-grid">
         <div className="card landing-choice usuario">
           <div className="landing-icon">🚗</div>
           <h2>Busco estacionamiento</h2>
           <p>Encuentra cupos cerca de tu destino y reserva tu lugar en segundos, sin crear cuenta.</p>
           <span className="badge ok">👇 Justo aquí abajo</span>
         </div>
         <div className="card landing-choice admin" onClick={()=>{setShowLogin(true);setAuthView('login');}}>
           <div className="landing-icon">🔑</div>
           <h2>Soy dueño o administrador</h2>
           <p>Gestiona tus estacionamientos, cobra tickets y revisa tus reportes de flujo y recaudación.</p>
           <button type="button">Iniciar sesión →</button>
         </div>
       </div>
       <BuscarCercanos reservaCodigoInicial={reservaCodigo}/>
     </main>
     <ChatBot onAbrirSolicitud={()=>setMostrarSolicitud(true)}/>
   </>;
 }

 return <>
 <nav>
   <div className="brand"><span className="logo">🅿️</span> Sistema de Estacionamientos <span className="role-pill">{user.rol}</span></div>
   <button onClick={()=>{localStorage.removeItem('token');setUser(null)}}>Salir</button>
 </nav>
 <PagoBanner estado={pago?.estado} monto={pago?.monto} onClose={()=>setPago(null)}/>
 <main className="container">
  {user.rol==='ADMIN'
    ? <AdminPanel user={user}/>
    : user.rol==='CLIENTE'
    ? <ClientePanel/>
    : user.rol==='SOPORTE'
    ? <SoportePanel/>
    : <BuscarCercanos reservaCodigoInicial={reservaCodigo}/>}
 </main>
 <ChatBot onAbrirSolicitud={()=>setMostrarSolicitud(true)}/>
 </>
}
export default App;
