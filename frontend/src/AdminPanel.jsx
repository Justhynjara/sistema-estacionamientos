import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import Pagination, { usePagination } from './Pagination.jsx';
import LocationPicker from './LocationPicker.jsx';
import SolicitudesTab from './SolicitudesTab.jsx';
import AuditLogTab from './AuditLogTab.jsx';
import Tarifa from './Tarifa.jsx';
import Icon from './Icon.jsx';
import TabsBase from './Tabs.jsx';
import Capacidad from './Capacidad.jsx';
import EstadoHorario from './EstadoHorario.jsx';
import HorarioEditor from './HorarioEditor.jsx';
import TarifasHorarioEditor from './TarifasHorarioEditor.jsx';
import { resumenHorario } from './utils/horario.js';

const TABS = [['usuarios', 'Usuarios', 'users'], ['parking', 'Estacionamientos', 'building'], ['solicitudes', 'Solicitudes', 'clipboard'], ['parametros', 'Parámetros', 'sliders'], ['auditoria', 'Auditoría', 'history']];
function Tabs({ tab, setTab }) {
  return <TabsBase tabs={TABS} tab={tab} setTab={setTab} label="Secciones de administración" />;
}

function ParkingTab({ parking, reloadParking, users }) {
  const [editandoHorario, setEditandoHorario] = useState(null); // id del estacionamiento
  const [editandoTarifas, setEditandoTarifas] = useState(null); // id del estacionamiento
  const initialForm = { cliente_id: '', nombre: '', direccion: '', precio_minuto: '', tarifa_minima: '', cupo_maximo: '' };
  const [form, setForm] = useState(initialForm);
  const [ubicacion, setUbicacion] = useState(null);
  const [reasignando, setReasignando] = useState(null); // { p, clienteId, loading }
  const clientes = users.filter(u => u.rol === 'CLIENTE');
  const { pageItems, page, setPage, totalPages } = usePagination(parking, 9);

  function dueñoDe(clienteId) {
    const u = users.find(u => u.id === clienteId);
    return u ? `${u.nombre} (${u.email})` : 'usuario no encontrado';
  }

  async function confirmarReasignacion() {
    const { p, clienteId } = reasignando;
    if (!clienteId) return;
    setReasignando(r => ({ ...r, loading: true }));
    try {
      await api.put(`/admin/parking/${p.id}/owner`, { cliente_id: clienteId });
      setReasignando(null);
      reloadParking();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cambiar el dueño');
      setReasignando(r => ({ ...r, loading: false }));
    }
  }

  async function crear(e) {
    e.preventDefault();
    if (!ubicacion) { alert('Marca la ubicación del estacionamiento en el mapa'); return; }
    try {
      await api.post('/admin/parking', {
        ...form,
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
        precio_minuto: Number(form.precio_minuto),
        tarifa_minima: Number(form.tarifa_minima || 0),
        cupo_maximo: Number(form.cupo_maximo)
      });
      setForm(initialForm);
      setUbicacion(null);
      reloadParking();
    } catch (err) { alert(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'Error al crear estacionamiento'); }
  }

  async function cambiarCupo(id, cupoActual) {
    const nuevo = prompt('Nuevo cupo máximo', cupoActual);
    if (!nuevo) return;
    try {
      await api.put(`/admin/parking/${id}/capacity`, { cupo_maximo: Number(nuevo) });
      reloadParking();
    } catch (err) { alert(err.response?.data?.error || 'Error al actualizar cupo'); }
  }

  async function eliminar(p) {
    if (!confirm(`¿Eliminar el estacionamiento "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/parking/${p.id}`);
      reloadParking();
    } catch (err) { alert(err.response?.data?.error || 'No se pudo eliminar el estacionamiento'); }
  }

  async function cambiarTarifa(p) {
    const precio = prompt('Nuevo precio por minuto (CLP)', Number(p.precio_minuto));
    if (precio === null || precio.trim() === '') return;
    const minima = prompt('Nuevo valor base mínimo (CLP)', Number(p.tarifa_minima));
    if (minima === null || minima.trim() === '') return;
    try {
      await api.put(`/admin/parking/${p.id}/pricing`, { precio_minuto: Number(precio), tarifa_minima: Number(minima) });
      reloadParking();
    } catch (err) { alert(err.response?.data?.detalles?.[0]?.mensaje || err.response?.data?.error || 'Error al actualizar la tarifa'); }
  }

  return (
    <>
      <div className="card">
        <h3>Registrar estacionamiento</h3>
        <form onSubmit={crear}>
          <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} required aria-label="Cliente dueño">
            <option value="">Cliente dueño...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
          </select>
          <input placeholder="Nombre" aria-label="Nombre del estacionamiento" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          <input placeholder="Dirección" aria-label="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} required />
          <LocationPicker value={ubicacion} onChange={setUbicacion} />
          <input type="number" min="0" step="any" placeholder="Precio por minuto (CLP)" aria-label="Precio por minuto" max="100000" value={form.precio_minuto} onChange={e => setForm({ ...form, precio_minuto: e.target.value })} required />
          <input type="number" min="0" step="any" placeholder="Valor base mínimo (CLP)" aria-label="Valor base mínimo" max="10000000" value={form.tarifa_minima} onChange={e => setForm({ ...form, tarifa_minima: e.target.value })} />
          <input type="number" inputMode="numeric" min="1" placeholder="Cupo máximo" aria-label="Cupo máximo" value={form.cupo_maximo} onChange={e => setForm({ ...form, cupo_maximo: e.target.value })} required />
          <button><Icon name="plus" />Crear estacionamiento</button>
        </form>
      </div>
      <div className="grid">
        {pageItems.map(p => (
          <div className="card" key={p.id}>
            <h3>{p.nombre}</h3>
            <p className="muted small" style={{ margin: 0 }}>{p.direccion}</p>
            <Capacidad libres={p.cupos_disponibles} total={p.cupo_maximo} />
            <p className="small" style={{ margin: 0 }}><Tarifa {...p} /></p>
            <p className="small" style={{ margin: 0 }}><EstadoHorario estado={p.horario_estado} /></p>
            <p className="muted small" style={{ margin: 0 }}><Icon name="clock" size={15} /> {resumenHorario(p.horario)}</p>
            <p className="muted small" style={{ margin: 0 }}><Icon name="user" size={15} /> Dueño: {dueñoDe(p.cliente_id)}</p>
            <p className="muted small" style={{ margin: 0 }}>
              <Icon name="ticket" size={15} /> <span className="mono">{p.total_tickets ?? 0}</span> tickets en total{p.tickets_activos ? ` (${p.tickets_activos} activo${p.tickets_activos === 1 ? '' : 's'} ahora)` : ''}
            </p>
            <div className="row-form">
              <button type="button" className="secondary small" onClick={() => cambiarCupo(p.id, p.cupo_maximo)}>Cambiar cupo máximo</button>
              <button type="button" className="secondary small" onClick={() => cambiarTarifa(p)}>Cambiar tarifa</button>
              <button type="button" className="secondary small" onClick={() => { setEditandoTarifas(null); setEditandoHorario(p.id); }} aria-label={`Horario de ${p.nombre}`}>Horario</button>
              <button type="button" className="secondary small" onClick={() => { setEditandoHorario(null); setEditandoTarifas(p.id); }} aria-label={`Tarifa por horario de ${p.nombre}`}>Tarifa por horario</button>
            </div>
            {editandoTarifas === p.id && (
              <TarifasHorarioEditor
                nombre={p.nombre}
                precioBase={p.precio_minuto}
                tarifas={p.tarifas_horario}
                onCancelar={() => setEditandoTarifas(null)}
                onGuardar={async tarifas_horario => { await api.put(`/admin/parking/${p.id}/tarifas-horario`, { tarifas_horario }); setEditandoTarifas(null); reloadParking(); }}
              />
            )}
            {editandoHorario === p.id && (
              <HorarioEditor
                nombre={p.nombre}
                horario={p.horario}
                onCancelar={() => setEditandoHorario(null)}
                onGuardar={async horario => { await api.put(`/admin/parking/${p.id}/horario`, { horario }); setEditandoHorario(null); reloadParking(); }}
              />
            )}
            {reasignando?.p.id === p.id ? (
              <div className="row-form">
                <select value={reasignando.clienteId} onChange={e => setReasignando({ ...reasignando, clienteId: e.target.value })} aria-label={`Nuevo dueño de ${p.nombre}`}>
                  <option value="">Nuevo dueño...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
                </select>
                <button type="button" onClick={confirmarReasignacion} disabled={!reasignando.clienteId || reasignando.loading}>
                  {reasignando.loading && <span className="spinner" />}Confirmar
                </button>
                <button type="button" className="secondary" onClick={() => setReasignando(null)} disabled={reasignando.loading}>Cancelar</button>
              </div>
            ) : (
              <div className="row-form">
                <button type="button" className="link-button" onClick={() => setReasignando({ p, clienteId: '', loading: false })}>Cambiar dueño</button>
                <button
                  type="button"
                  className="danger small"
                  disabled={(p.total_tickets ?? 0) > 0}
                  title={(p.total_tickets ?? 0) > 0 ? 'No se puede eliminar: tiene tickets en su historial. Solo se eliminan estacionamientos sin movimientos.' : undefined}
                  onClick={() => eliminar(p)}
                  aria-label={`Eliminar ${p.nombre}`}
                ><Icon name="trash" size={16} />Eliminar</button>
              </div>
            )}
          </div>
        ))}
        {parking.length===0 && <div className="empty-state">No hay estacionamientos registrados todavía.</div>}
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}

function CrearUsuarioForm({ reloadUsers }) {
  const initialForm = { nombre: '', email: '', password: '', rol: 'USUARIO' };
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/admin/users', form);
      setForm(initialForm);
      reloadUsers();
    } catch (err) { setError(err.response?.data?.error || 'Error al crear usuario'); }
    finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3>Crear usuario</h3>
      {error && <p className="badge off">{error}</p>}
      <form onSubmit={crear} className="row-form">
        <input placeholder="Nombre" aria-label="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
        <input type="email" placeholder="Email" aria-label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input type="password" placeholder="Contraseña (mín. 8 caracteres)" aria-label="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
        <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} aria-label="Rol del nuevo usuario">
          <option value="USUARIO">USUARIO</option>
          <option value="CLIENTE">CLIENTE</option>
          <option value="SOPORTE">SOPORTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button disabled={loading}>{loading ? <span className="spinner" /> : <Icon name="plus" />}Crear usuario</button>
      </form>
    </div>
  );
}

function UsersTab({ users, reloadUsers, currentUserId }) {
  const [q, setQ] = useState('');
  const [rolFiltro, setRolFiltro] = useState('TODOS');
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS');

  // El listado se carga entero (cientos de filas cargan sin problema), así que el filtro es local
  // e instantáneo. Si algún día crece a muchos miles, conviene pasar a paginación en el servidor.
  const filtrados = users.filter(u => {
    if (q.trim() && !`${u.nombre} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (rolFiltro !== 'TODOS' && u.rol !== rolFiltro) return false;
    if (estadoFiltro === 'ACTIVO' && !u.activo) return false;
    if (estadoFiltro === 'INACTIVO' && u.activo) return false;
    return true;
  });
  const { pageItems, page, setPage, totalPages } = usePagination(filtrados, 10);
  useEffect(() => { setPage(1); }, [q, rolFiltro, estadoFiltro]);

  async function toggleActivo(u) {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { activo: !u.activo });
      reloadUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error al cambiar estado'); }
  }
  async function cambiarRol(u, rol) {
    if (rol === u.rol) return;
    try {
      await api.patch(`/admin/users/${u.id}/role`, { rol });
      reloadUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error al cambiar rol'); }
  }
  async function eliminar(u) {
    if (!confirm(`¿Eliminar a ${u.nombre} (${u.email})? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      reloadUsers();
    } catch (err) { alert(err.response?.data?.error || 'No se pudo eliminar el usuario'); }
  }
  return (
    <>
    <CrearUsuarioForm reloadUsers={reloadUsers} />
    <div className="card">
      <h3>Usuarios</h3>
      <div className="row-form filtros-admin">
        <input type="search" placeholder="Buscar por nombre o email…" aria-label="Buscar usuarios" value={q} onChange={e => setQ(e.target.value)} />
        <select value={rolFiltro} onChange={e => setRolFiltro(e.target.value)} aria-label="Filtrar por rol">
          <option value="TODOS">Todos los roles</option>
          <option value="USUARIO">USUARIO</option>
          <option value="CLIENTE">CLIENTE</option>
          <option value="SOPORTE">SOPORTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} aria-label="Filtrar por estado">
          <option value="TODOS">Todos los estados</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Mostrando <span className="mono">{filtrados.length}</span> de <span className="mono">{users.length}</span></p>
      <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>
          {filtrados.length === 0 && <tr><td colSpan={5} className="muted">Ningún usuario coincide con el filtro.</td></tr>}
          {pageItems.map(u => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.rol} disabled={u.id === currentUserId} onChange={e => cambiarRol(u, e.target.value)} aria-label={`Rol de ${u.nombre}`}>
                  <option value="USUARIO">USUARIO</option>
                  <option value="CLIENTE">CLIENTE</option>
                  <option value="SOPORTE">SOPORTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td><span className={'badge ' + (u.activo ? 'ok' : 'off')}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td className="acciones">
                <div className="row-form">
                  <button type="button" className="secondary small" disabled={u.id === currentUserId} onClick={() => toggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  <button type="button" className="danger small" disabled={u.id === currentUserId} onClick={() => eliminar(u)} aria-label={`Eliminar a ${u.nombre}`} style={{ marginLeft: 12 }}><Icon name="trash" size={16} />Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
    </>
  );
}

function ParamRow({ p, onSave }) {
  const [valor, setValor] = useState(p.valor);
  return (
    <div className="param-row">
      <div><code>{p.clave}</code><br /><small className="muted">{p.descripcion}</small></div>
      <input className="mono" value={valor} onChange={e => setValor(e.target.value)} aria-label={`Valor de ${p.clave}`} />
      <button type="button" className="small" onClick={() => onSave(p.clave, valor)}>Guardar</button>
    </div>
  );
}

function ParamsTab({ params, reloadParams }) {
  async function guardar(clave, valor) {
    try {
      await api.put(`/admin/params/${clave}`, { valor });
      reloadParams();
    } catch (err) { alert(err.response?.data?.error || 'Error al guardar parámetro'); }
  }
  return (
    <div className="card">
      <h3>Parámetros del sistema</h3>
      {params.map(p => <ParamRow key={p.clave} p={p} onSave={guardar} />)}
    </div>
  );
}

export default function AdminPanel({ user }) {
  const [tab, setTab] = useState('usuarios');
  const [parking, setParking] = useState([]);
  const [users, setUsers] = useState([]);
  const [params, setParams] = useState([]);

  // El listado público (/parking) oculta cliente_id a propósito; el admin necesita verlo para
  // saber (y poder corregir) a quién pertenece cada estacionamiento.
  const reloadParking = () => api.get('/admin/parking').then(r => setParking(r.data));
  const reloadUsers = () => api.get('/admin/users').then(r => setUsers(r.data));
  const reloadParams = () => api.get('/admin/params').then(r => setParams(r.data));

  useEffect(() => { reloadParking(); reloadUsers(); reloadParams(); }, []);

  return (
    <div>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'usuarios' && <UsersTab users={users} reloadUsers={reloadUsers} currentUserId={user.id} />}
      {tab === 'parking' && <ParkingTab parking={parking} reloadParking={reloadParking} users={users} />}
      {tab === 'solicitudes' && <SolicitudesTab />}
      {tab === 'parametros' && <ParamsTab params={params} reloadParams={reloadParams} />}
      {tab === 'auditoria' && <AuditLogTab />}
    </div>
  );
}
