"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Instanciamos el cliente seguro del navegador
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Si todo va bien, vamos a la pantalla principal
        router.push('/');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: email === 'admin@admin.com' ? 'admin' : 'user', // Asignamos rol según el correo
            }
          }
        });
        if (error) throw error;
        
        // Tras registrar, iniciamos sesión automáticamente
        await supabase.auth.signInWithPassword({ email, password });
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div className="flex flex-col items-center justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-operpal.png" alt="OPERPAL" className="h-16 w-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800">DeCA Digital</h1>
          <p className="text-sm text-slate-500">Gestión de Documentos de Transporte</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm mb-4 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                placeholder="Ej. Juan Pérez"
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="correo@empresa.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Procesando...' : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            type="button"
            className="ml-1 text-blue-600 font-bold hover:underline"
          >
            {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
          </button>
        </div>

        
      </div>
    </div>
  );
}