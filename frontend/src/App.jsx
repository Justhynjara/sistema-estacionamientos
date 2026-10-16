import {useEffect,useState} from 'react';
import {api} from './services/api.js';
import AdminPanel from './AdminPanel.jsx';
import ClientePanel from './ClientePanel.jsx';
import BuscarCercanos from './BuscarCercanos.jsx';
import ChatBot from './ChatBot.jsx';
import SolicitudClienteForm from './SolicitudClienteForm.jsx';
import SoportePanel from './SoportePanel.jsx';
import TicketPublico from './TicketPublico.jsx';
import LegalPage from './legal/LegalPage.jsx';
import Footer from './legal/Footer.jsx';
import CookieNotice from './legal/CookieNotice.jsx';
import {CONTACTO_LEGAL} from './legal/contenido.js';
import Icon,{SignE} from './Icon.jsx';

const NOMBRE_ROL={ADMIN:'Administrador',CLIENTE:'Dueño',SOPORTE:'Soporte',USUARIO:'Conductor'};
const TITULO_PANEL={ADMIN:'Administración',CLIENTE:'Panel del dueño',SOPORTE:'Soporte',USUARIO:'Buscar estacionamiento'};

function Header({user,onSalir,onAcceso,onPostular}){
  return <header className="site-header">
    <a className="brand" href="/"><SignE/>Sistema de Estacionamientos</a>
    <div className="actions">
      {user
        ? <>
            <span className="role-pill">{NOMBRE_ROL[user.rol]||user.rol}</span>
            <button type="button" className="secondary small" onClick={onSalir}><Icon name="logout" size={16}/>Salir</button>
          </>
        : <>
            {onPostular && <button type="button" className="navlink opcional" onClick={onPostular}>Postular mi estacionamiento</button>}
            {onAcceso && <button type="button" className="secondary small" onClick={onAcceso}><Icon name="key" size={16}/>Acceso dueños</button>}
          </>}
    </div>
  </header>;
}

function LoginShell({children}){
  return <div className="login-shell">
    <header className="site-header"><a className="brand" href="/"><SignE/>Sistema de Estacionamientos</a></header>
    <main className="login-main"><div className="card login-card">{children}</div></main>
    <Footer/>
  </div>;
}

function Login({onLogin,onCancel,onForgot}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  async function submit(e){
    e.preventDefault();
    setLoading(true);
    try{const r=await api.post('/auth/login',{email,password});onLogin(r.data.user)}
    catch{alert('Credenciales inválidas')}
    finally{setLoading(false)}
  }
  return <LoginShell>
    <div className="login-head"><SignE size={40}/><h1>Acceso Cliente / Administrador</h1></div>
    <p className="lead">Solo dueños de estacionamientos y administradores necesitan iniciar sesión. Para buscar o reservar un cupo no hace falta una cuenta.</p>
    <form onSubmit={submit}>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@correo.cl" aria-label="Email"/>
      <label htmlFor="login-clave">Contraseña</label>
      <input id="login-clave" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} aria-label="Contraseña"/>
      <button type="submit" disabled={loading}>{loading && <span className="spinner"/>}{loading?'Ingresando...':'Iniciar sesión'}</button>
    </form>
    <div className="enlaces">
      <button type="button" onClick={onCancel} className="link-button"><Icon name="arrowLeft" size={16}/>Volver a la búsqueda</button>
      <button type="button" onClick={onForgot} className="link-button">¿Olvidaste tu contraseña?</button>
    </div>
  </LoginShell>;
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
  return <LoginShell>
    <div className="login-head"><SignE size={40}/><h1>Recuperar contraseña</h1></div>
    <p className="lead">Ingresa tu email y te enviaremos un enlace para definir una nueva contraseña.</p>
    {mensaje
      ? <p className="badge ok">{mensaje}</p>
      : <form onSubmit={submit}>
          <label htmlFor="forgot-email">Email</label>
          <input id="forgot-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@correo.cl" aria-label="Email" required/>
          <button type="submit" disabled={loading}>{loading && <span className="spinner"/>}{loading?'Enviando...':'Enviar enlace'}</button>
        </form>}
    <div className="enlaces">
      <button type="button" onClick={onBack} className="link-button"><Icon name="arrowLeft" size={16}/>Volver al inicio de sesión</button>
    </div>
  </LoginShell>;
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
  return <LoginShell>
    <div className="login-head"><SignE size={40}/><h1>Definir nueva contraseña</h1></div>
    {mensaje
      ? <>
          <p className="badge ok">{mensaje}</p>
          <button type="button" onClick={onDone} style={{width:'100%'}}>Ir a iniciar sesión</button>
        </>
      : <form onSubmit={submit}>
          {error && <p className="badge off">{error}</p>}
          <label htmlFor="reset-clave">Nueva contraseña</label>
          <input id="reset-clave" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" aria-label="Nueva contraseña" required minLength={8}/>
          <button type="submit" disabled={loading}>{loading && <span className="spinner"/>}{loading?'Guardando...':'Guardar contraseña'}</button>
        </form>}
  </LoginShell>;
}

function PagoBanner({estado,monto,orden,onClose}){
  if(!estado) return null;
  const montoTxt=monto?` de $${Number(monto).toLocaleString('es-CL')}`:'';
  const textos={
    aprobado:{cls:'ok',texto:`Pago aprobado${monto?` por $${Number(monto).toLocaleString('es-CL')}`:''}.`},
    rechazado:{cls:'off',texto:'El pago fue rechazado. Intenta con otra tarjeta.'},
    cancelado:{cls:'off',texto:'Pago cancelado.'},
    // El cupo se ocupó entre que empezaste a pagar y la confirmación: el backend anula el cargo en Webpay.
    reembolsado:{cls:'off',texto:`No pudimos reservar: el último cupo se ocupó justo antes de confirmar tu pago. Anulamos el cobro${montoTxt} en Webpay, así que no se te cobrará nada. Según tu banco, la devolución puede tardar unos días hábiles en verse en tu cartola.`},
    sin_cupo:{cls:'off',texto:`No pudimos reservar: el último cupo se ocupó justo antes de confirmar tu pago${montoTxt}. Todavía no logramos anular el cobro en Webpay; lo seguiremos intentando automáticamente. Si en 5 días hábiles no ves la devolución, escríbenos a ${CONTACTO_LEGAL}${orden?` indicando la orden de compra ${orden}`:''}.`},
    error:{cls:'off',texto:'Ocurrió un error al confirmar el pago.'}
  };
  const info=textos[estado];
  if(!info) return null;
  return <div className="pago-banner">
    {/* Botón real (no un <p onClick>): así se puede cerrar el aviso con el teclado, no solo con el mouse. */}
    <button type="button" className={'badge '+info.cls} onClick={onClose} aria-label={`${info.texto} Cerrar aviso`}>
      <span>{info.texto}</span><Icon name="x" size={16} className="cerrar"/>
    </button>
  </div>;
}

function SignBand({titulo,children,slim}){
  return <div className={'sign-band'+(slim?' slim':'')}>
    <div className="inner">
      <h1>{titulo}</h1>
      {children}
    </div>
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
 const [ticketCodigo,setTicketCodigo]=useState(null);
 const [legalPage,setLegalPage]=useState(null);

 function cerrarLegal(){
   setLegalPage(null);
   const url=new URL(window.location.href);
   url.searchParams.delete('legal');
   window.history.replaceState({},'',url);
 }

 // El QR del ticket abre la web con ?ticket=CODIGO. Se deja en la URL mientras se muestra la
 // vista pública, para que recargar la página (o guardarla) no la pierda.
 function cerrarTicket(){
   setTicketCodigo(null);
   const url=new URL(window.location.href);
   url.searchParams.delete('ticket');
   window.history.replaceState({},'',url);
 }

 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const reset=params.get('reset');
   const pagoEstado=params.get('pago');
   const reserva=params.get('reserva');
   const ticket=params.get('ticket');
   const legal=params.get('legal');
   if(ticket) setTicketCodigo(ticket);
   if(reset) setResetToken(reset);
   if(pagoEstado) setPago({estado:pagoEstado, monto:params.get('monto'), orden:params.get('orden')});
   if(reserva) setReservaCodigo(reserva);
   if(legal) setLegalPage(legal);
   if(reset || pagoEstado || reserva){
     const url=new URL(window.location.href);
     url.search='';
     if(ticket) url.searchParams.set('ticket',ticket);
     if(legal) url.searchParams.set('legal',legal);
     window.history.replaceState({},'',url);
   }
 },[]);

 // La sesión ya no se guarda en localStorage: se restaura preguntándole al servidor, que decide
 // según la cookie httpOnly que el navegador manda solo (si no hay cookie o ya expiró, responde 401
 // y se sigue sin sesión, sin error visible).
 useEffect(()=>{
   api.get('/auth/me')
     .then(r=>setUser(r.data))
     .catch(()=>{})
     .finally(()=>setCheckingSession(false));
 },[]);

 async function salir(){
   try{ await api.post('/auth/logout'); } catch{ /* si ya no hay sesión, no importa */ }
   setUser(null);
 }

 useEffect(()=>{
   const onLogout=()=>setUser(null);
   window.addEventListener('auth:logout',onLogout);
   return ()=>window.removeEventListener('auth:logout',onLogout);
 },[]);

 const abrirLogin=()=>{setShowLogin(true);setAuthView('login');};

 if(checkingSession) return <div className="login-shell"><main className="login-main"><p className="loading-line"><span className="spinner"/>Cargando sesión…</p></main></div>;

 if(resetToken){
   return <ResetPassword token={resetToken} onDone={()=>{setResetToken(null); setShowLogin(true); setAuthView('login');}}/>;
 }

 if(legalPage){
   return <>
     <Header/>
     <main className="container legal"><LegalPage pagina={legalPage} onVolver={cerrarLegal}/></main>
     <Footer/>
   </>;
 }

 if(mostrarSolicitud){
   return <>
     <Header/>
     <SignBand titulo="Postula tu estacionamiento" slim/>
     <main className="container" style={{maxWidth:880}}>
       <SolicitudClienteForm onCerrar={()=>setMostrarSolicitud(false)}/>
     </main>
     <Footer/>
   </>;
 }

 if(!user && showLogin){
   if(authView==='forgot') return <ForgotPassword onBack={()=>setAuthView('login')}/>;
   return <Login onLogin={u=>{setUser(u);setShowLogin(false);}} onCancel={()=>setShowLogin(false)} onForgot={()=>setAuthView('forgot')}/>;
 }

 // Vista pública del ticket (QR escaneado con la cámara). Un dueño con sesión iniciada no la ve:
 // cae directo al cobro más abajo (ClientePanel).
 if(ticketCodigo && (!user || user.rol!=='CLIENTE')){
   return <>
     <Header user={user} onSalir={salir}/>
     <main className="container">
       <TicketPublico
         codigo={ticketCodigo}
         onEntrarDueno={user ? undefined : abrirLogin}
         onCerrar={cerrarTicket}
       />
     </main>
     <Footer/>
     <CookieNotice/>
   </>;
 }

 if(!user){
   return <>
     <Header onAcceso={abrirLogin} onPostular={()=>setMostrarSolicitud(true)}/>
     <SignBand titulo="Encuentra estacionamiento cerca de tu destino">
       <p><span className="live"><span className="live-dot" aria-hidden="true"/>Cupos en tiempo real</span><br/>Sin registro. Reserva tu cupo por $100, que se descuentan al salir.</p>
     </SignBand>
     <PagoBanner estado={pago?.estado} monto={pago?.monto} orden={pago?.orden} onClose={()=>setPago(null)}/>
     <main>
       <BuscarCercanos reservaCodigoInicial={reservaCodigo}/>
       <section className="owner-strip" aria-labelledby="owner-strip-titulo">
         <div className="inner">
           <SignE size={40}/>
           <div>
             <h2 id="owner-strip-titulo">¿Administras un estacionamiento?</h2>
             <p>Emite y cobra tickets con QR, mira tu ocupación en tiempo real y revisa lo recaudado en el día.</p>
           </div>
           <div className="acciones">
             <button type="button" className="secondary" onClick={()=>setMostrarSolicitud(true)}>Postular mi estacionamiento</button>
             <button type="button" className="dark" onClick={abrirLogin}>Ingresar<Icon name="arrowRight" size={16}/></button>
           </div>
         </div>
       </section>
     </main>
     <ChatBot onAbrirSolicitud={()=>setMostrarSolicitud(true)}/>
     <Footer/>
     <CookieNotice/>
   </>;
 }

 return <>
 <Header user={user} onSalir={salir}/>
 <SignBand titulo={TITULO_PANEL[user.rol]||'Panel'} slim>
   <p>{user.nombre}</p>
 </SignBand>
 <PagoBanner estado={pago?.estado} monto={pago?.monto} orden={pago?.orden} onClose={()=>setPago(null)}/>
 <main className="container">
  {user.rol==='ADMIN'
    ? <AdminPanel user={user}/>
    : user.rol==='CLIENTE'
    ? <ClientePanel ticketInicial={ticketCodigo} onTicketConsumido={cerrarTicket}/>
    : user.rol==='SOPORTE'
    ? <SoportePanel/>
    : <BuscarCercanos reservaCodigoInicial={reservaCodigo}/>}
 </main>
 <Footer/>
 <CookieNotice/>
 </>
}
export default App;
