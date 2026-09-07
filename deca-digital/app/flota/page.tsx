"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { ArrowLeft, Truck, User, Trash2, Pencil, Plus, X } from 'lucide-react';

type Tab = 'transportistas' | 'conductores' | 'tractoras';

export default function FlotaPanel() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('transportistas');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [carriers, setCarriers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tractors, setTractors] = useState<any[]>([]);

  // Formulario de Transportista
  const [carrierForm, setCarrierForm] = useState({ id: '', company_name: '', cif: '', address: '', phone: '' });
  // Formulario de Conductor
  const [driverForm, setDriverForm] = useState({ id: '', name: '', dni: '', email: '', phone: '', carrier_id: '' });
  // Formulario de Tractora
  const [tractorForm, setTractorForm] = useState({ id: '', tractor_plate: '', trailer_plate: '', carrier_id: '' });

  const loadAll = async (uid: string) => {
    const [c, d, t] = await Promise.all([
      supabase.from('carriers').select('*').eq('user_id', uid).order('company_name'),
      supabase.from('drivers').select('*').eq('user_id', uid).order('name'),
      supabase.from('tractors').select('*').eq('user_id', uid).order('tractor_plate'),
    ]);
    setCarriers(c.data || []);
    setDrivers(d.data || []);
    setTractors(t.data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      await loadAll(session.user.id);
      setLoading(false);
    };
    init();
  }, []);

  const resetForms = () => {
    setCarrierForm({ id: '', company_name: '', cif: '', address: '', phone: '' });
    setDriverForm({ id: '', name: '', dni: '', email: '', phone: '', carrier_id: '' });
    setTractorForm({ id: '', tractor_plate: '', trailer_plate: '', carrier_id: '' });
  };

  // --- Transportistas ---
  const saveCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const payload = { company_name: carrierForm.company_name, cif: carrierForm.cif, address: carrierForm.address, phone: carrierForm.phone, user_id: userId };
    if (carrierForm.id) {
      await supabase.from('carriers').update(payload).eq('id', carrierForm.id);
    } else {
      await supabase.from('carriers').insert([payload]);
    }
    resetForms();
    await loadAll(userId);
  };

  const editCarrier = (c: any) => setCarrierForm({ id: c.id, company_name: c.company_name, cif: c.cif, address: c.address || '', phone: c.phone || '' });

  const deleteCarrier = async (id: string) => {
    if (!confirm('¿Eliminar este transportista? Los conductores y tractoras vinculados quedarán sin vincular, pero no se borran.')) return;
    await supabase.from('carriers').delete().eq('id', id);
    if (userId) await loadAll(userId);
  };

  // --- Conductores ---
  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const payload = {
      name: driverForm.name, dni: driverForm.dni, email: driverForm.email || null,
      phone: driverForm.phone, carrier_id: driverForm.carrier_id || null, user_id: userId
    };
    if (driverForm.id) {
      await supabase.from('drivers').update(payload).eq('id', driverForm.id);
    } else {
      await supabase.from('drivers').insert([payload]);
    }
    resetForms();
    await loadAll(userId);
  };

  const editDriver = (d: any) => setDriverForm({ id: d.id, name: d.name, dni: d.dni || '', email: d.email || '', phone: d.phone || '', carrier_id: d.carrier_id || '' });

  const deleteDriver = async (id: string) => {
    if (!confirm('¿Eliminar este conductor?')) return;
    await supabase.from('drivers').delete().eq('id', id);
    if (userId) await loadAll(userId);
  };

  // --- Tractoras ---
  const saveTractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const payload = {
      tractor_plate: tractorForm.tractor_plate, trailer_plate: tractorForm.trailer_plate || null,
      carrier_id: tractorForm.carrier_id || null, user_id: userId
    };
    if (tractorForm.id) {
      await supabase.from('tractors').update(payload).eq('id', tractorForm.id);
    } else {
      await supabase.from('tractors').insert([payload]);
    }
    resetForms();
    await loadAll(userId);
  };

  const editTractor = (t: any) => setTractorForm({ id: t.id, tractor_plate: t.tractor_plate, trailer_plate: t.trailer_plate || '', carrier_id: t.carrier_id || '' });

  const deleteTractor = async (id: string) => {
    if (!confirm('¿Eliminar esta tractora?')) return;
    await supabase.from('tractors').delete().eq('id', id);
    if (userId) await loadAll(userId);
  };

  const carrierName = (carrierId: string | null) => carriers.find(c => c.id === carrierId)?.company_name || '—';

  const q = search.trim().toLowerCase();
  const filteredCarriers = carriers.filter(c => !q || c.company_name?.toLowerCase().includes(q) || c.cif?.toLowerCase().includes(q));
  const filteredDrivers = drivers.filter(d => !q || d.name?.toLowerCase().includes(q) || d.dni?.toLowerCase().includes(q));
  const filteredTractors = tractors.filter(t => !q || t.tractor_plate?.toLowerCase().includes(q) || t.trailer_plate?.toLowerCase().includes(q));

  if (loading) return <div className="p-10 text-center">Cargando panel de flota...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto w-full">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Volver al Tablero
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Gestión de Flota</h2>
          <p className="text-sm text-slate-500 mt-1">Guarda tus transportistas, conductores y tractoras habituales para rellenar los DeCA más rápido.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex gap-2">
            {(['transportistas', 'conductores', 'tractoras'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); resetForms(); setSearch(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'transportistas' ? 'Buscar por empresa o CIF...' : tab === 'conductores' ? 'Buscar por nombre o DNI...' : 'Buscar por matrícula...'}
            className="w-full sm:w-72 px-3 py-2 border rounded-lg text-sm text-slate-900 bg-white"
          />
        </div>

        {/* TRANSPORTISTAS */}
        {tab === 'transportistas' && (
          <div className="space-y-6">
            <form onSubmit={saveCarrier} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" /> {carrierForm.id ? 'Editar' : 'Nuevo'} Transportista</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required placeholder="Empresa Transportista" value={carrierForm.company_name} onChange={e => setCarrierForm({ ...carrierForm, company_name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input required placeholder="CIF" value={carrierForm.cif} onChange={e => setCarrierForm({ ...carrierForm, cif: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input placeholder="Domicilio" value={carrierForm.address} onChange={e => setCarrierForm({ ...carrierForm, address: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900 sm:col-span-2" />
                <input placeholder="Teléfono de Contacto" value={carrierForm.phone} onChange={e => setCarrierForm({ ...carrierForm, phone: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {carrierForm.id ? 'Guardar Cambios' : 'Añadir'}</button>
                {carrierForm.id && <button type="button" onClick={resetForms} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><X className="w-4 h-4" /> Cancelar</button>}
              </div>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold"><tr><th className="p-3">Empresa</th><th className="p-3">CIF</th><th className="p-3">Teléfono</th><th className="p-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-900">
                  {filteredCarriers.map(c => (
                    <tr key={c.id}>
                      <td className="p-3 font-semibold">{c.company_name}</td>
                      <td className="p-3">{c.cif}</td>
                      <td className="p-3">{c.phone}</td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button onClick={() => editCarrier(c)} className="text-amber-600 hover:text-amber-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteCarrier(c.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredCarriers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">{carriers.length === 0 ? 'Sin transportistas guardados' : 'Sin resultados para esa búsqueda'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONDUCTORES */}
        {tab === 'conductores' && (
          <div className="space-y-6">
            <form onSubmit={saveDriver} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> {driverForm.id ? 'Editar' : 'Nuevo'} Conductor</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required placeholder="Nombre" value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input placeholder="DNI" value={driverForm.dni} onChange={e => setDriverForm({ ...driverForm, dni: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input placeholder="Teléfono" value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input type="email" placeholder="Email (opcional)" value={driverForm.email} onChange={e => setDriverForm({ ...driverForm, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <select value={driverForm.carrier_id} onChange={e => setDriverForm({ ...driverForm, carrier_id: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 sm:col-span-2">
                  <option value="">Sin vincular a ningún transportista</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {driverForm.id ? 'Guardar Cambios' : 'Añadir'}</button>
                {driverForm.id && <button type="button" onClick={resetForms} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><X className="w-4 h-4" /> Cancelar</button>}
              </div>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold"><tr><th className="p-3">Nombre</th><th className="p-3">DNI</th><th className="p-3">Transportista</th><th className="p-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-900">
                  {filteredDrivers.map(d => (
                    <tr key={d.id}>
                      <td className="p-3 font-semibold">{d.name}</td>
                      <td className="p-3">{d.dni}</td>
                      <td className="p-3">{carrierName(d.carrier_id)}</td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button onClick={() => editDriver(d)} className="text-amber-600 hover:text-amber-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteDriver(d.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredDrivers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">{drivers.length === 0 ? 'Sin conductores guardados' : 'Sin resultados para esa búsqueda'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TRACTORAS */}
        {tab === 'tractoras' && (
          <div className="space-y-6">
            <form onSubmit={saveTractor} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" /> {tractorForm.id ? 'Editar' : 'Nueva'} Tractora</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required placeholder="Matrícula Tractora" value={tractorForm.tractor_plate} onChange={e => setTractorForm({ ...tractorForm, tractor_plate: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <input placeholder="Matrícula Remolque (opcional)" value={tractorForm.trailer_plate} onChange={e => setTractorForm({ ...tractorForm, trailer_plate: e.target.value })} className="px-3 py-2 border rounded-lg text-sm text-slate-900" />
                <select value={tractorForm.carrier_id} onChange={e => setTractorForm({ ...tractorForm, carrier_id: e.target.value })} className="px-3 py-2 border rounded-lg text-sm bg-white text-slate-900 sm:col-span-2">
                  <option value="">Sin vincular a ningún transportista</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> {tractorForm.id ? 'Guardar Cambios' : 'Añadir'}</button>
                {tractorForm.id && <button type="button" onClick={resetForms} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><X className="w-4 h-4" /> Cancelar</button>}
              </div>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold"><tr><th className="p-3">Matrícula Tractora</th><th className="p-3">Remolque</th><th className="p-3">Transportista</th><th className="p-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-900">
                  {filteredTractors.map(t => (
                    <tr key={t.id}>
                      <td className="p-3 font-semibold">{t.tractor_plate}</td>
                      <td className="p-3">{t.trailer_plate || '—'}</td>
                      <td className="p-3">{carrierName(t.carrier_id)}</td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button onClick={() => editTractor(t)} className="text-amber-600 hover:text-amber-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteTractor(t.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredTractors.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">{tractors.length === 0 ? 'Sin tractoras guardadas' : 'Sin resultados para esa búsqueda'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
