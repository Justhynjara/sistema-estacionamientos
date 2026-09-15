import { useEffect, useState } from 'react';
import { api } from './services/api.js';
import Pagination, { usePagination } from './Pagination.jsx';
import LocationPicker from './LocationPicker.jsx';
import SolicitudesTab from './SolicitudesTab.jsx';

function Tabs({ tab, setTab }) {
  const tabs = [['usuarios', '👤 Usuarios'], ['parking', '🅿️ Estacionamientos'], ['solicitudes', '📋 Solicitudes'], ['parametros', '⚙️ Parámetros']];
  return (
    <div className="tabs">
      {tabs.map(([k, label]) => (
        <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}>{label}</button>
      ))}
    </div>
  );
}

function ParkingTab({ parking, reloadParking, users }) {
  const initialForm = { cliente_id: '', nombre: '', direccion: '', precio_hora: '', cupo_maximo: '' };
  const [form, setForm] = useState(initialForm);
  const [ubicacion, setUbicacion] = useState(null);
  const clientes = users.filter(u => u.rol === 'CLIENTE');
  const { pageItems, page, setPage, totalPages } = usePagination(parking, 9);

  async function crear(e) {
    e.preventDefault();
    if (!ubicacion) { alert('Marca la ubicación del estacionamiento en el mapa'); return; }
    try {
      await api.post('/admin/parking', {
        ...form,
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
        precio_hora: Number(form.precio_hora),
        cupo_maximo: Number(form.cupo_maximo)
      });
      setForm(initialForm);
      setUbicacion(null);
      reloadParking();
    } catch (err) { alert(err.response?.data?.error || 'Error al crear estacionamiento'); }
  }

  async function cambiarCupo(id, cupoActual) {
    const nuevo = prompt('Nuevo cupo máximo', cupoActual);
    if (!nuevo) return;
    try {
      await api.put(`/admin/parking/${id}/capacity`, { cupo_maximo: Number(nuevo) });
      reloadParking();
    } catch (err) { alert(err.response?.data?.error || 'Error al actualizar cupo'); }
  }

  return (
    <>
      <div className="card">
        <h3>Registrar estacionamiento</h3>
        <form onSubmit={crear}>
          <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })} required>
            <option value="">Cliente dueño...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>)}
          </select>
          <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} required />
          <LocationPicker value={ubicacion} onChange={setUbicacion} />
          <input placeholder="Precio por hora" value={form.precio_hora} onChange={e => setForm({ ...form, precio_hora: e.target.value })} required />
          <input placeholder="Cupo máximo" value={form.cupo_maximo} onChange={e => setForm({ ...form, cupo_maximo: e.target.value })} required />
          <button>Crear estacionamiento</button>
        </form>
      </div>
      <div className="grid">
        {pageItems.map(p => (
          <div className="card" key={p.id}>
            <h3>{p.nombre}</h3>
            <p>{p.direccion}</p>
            <p className={'badge ' + (p.cupos_disponibles > 0 ? 'ok' : 'off')}>🅿️ {p.cupos_disponibles} / {p.cupo_maximo} disponibles</p>
            <button onClick={() => cambiarCupo(p.id, p.cupo_maximo)}>Cambiar cupo máximo</button>
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
      {error && <p className="badge off">⚠️ {error}</p>}
      <form onSubmit={crear} className="row-form">
        <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
        <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
        <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} aria-label="Rol del nuevo usuario">
          <option value="USUARIO">USUARIO</option>
          <option value="CLIENTE">CLIENTE</option>
          <option value="SOPORTE">SOPORTE</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button disabled={loading}>{loading && <span className="spinner" />}Crear usuario</button>
      </form>
    </div>
  );
}

function UsersTab({ users, reloadUsers, currentUserId }) {
  const { pageItems, page, setPage, totalPages } = usePagination(users, 10);

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
  return (
    <>
    <CrearUsuarioForm reloadUsers={reloadUsers} />
    <div className="card">
      <h3>Usuarios</h3>
      <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {pageItems.map(u => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.rol} disabled={u.id === currentUserId} onChange={e => cambiarRol(u, e.target.value)}>
                  <option value="USUARIO">USUARIO</option>
                  <option value="CLIENTE">CLIENTE</option>
                  <option value="SOPORTE">SOPORTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </td>
              <td><span className={'badge ' + (u.activo ? 'ok' : 'off')}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
              <td><button disabled={u.id === currentUserId} onClick={() => toggleActivo(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button></td>
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
      <div><strong>{p.clave}</strong><br /><small>{p.descripcion}</small></div>
      <input value={valor} onChange={e => setValor(e.target.value)} />
      <button onClick={() => onSave(p.clave, valor)}>Guardar</button>
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

  const reloadParking = () => api.get('/parking').then(r => setParking(r.data));
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
    </div>
  );
}
