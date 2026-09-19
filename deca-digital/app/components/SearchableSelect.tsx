"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Desplegable con buscador integrado — sustituye al <select> nativo en todos
 * los desplegables de flota. Muestra las opciones en un panel flotante y
 * filtra en tiempo real mientras escribes, sin que haga falta hacer scroll
 * por listas largas.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Enfocar el input del buscador nada más abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Botón que parece un <select> */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 ml-2 shrink-0">
          {selected && (
            <span onClick={handleClear} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Panel desplegable */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Buscador */}
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Lista de opciones */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {/* Opción vacía (limpiar selección) */}
            <li>
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50"
              >
                {placeholder}
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</li>
            ) : (
              filtered.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 ${
                      opt.value === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
