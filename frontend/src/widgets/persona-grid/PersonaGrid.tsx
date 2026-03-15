import React from 'react';

interface Persona {
  id: string;
  name: string;
  role: string;
  history: string;
  isCustom?: boolean;
}

interface PersonaGridProps {
  personas: Persona[];
  onSelect: (persona: Persona) => void;
  onCreateNew: () => void;
}

export function PersonaGrid({ personas, onSelect, onCreateNew }: PersonaGridProps) {
  return (
    <div className="flex flex-wrap justify-center gap-6 max-w-6xl w-full">
      {personas.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="flex flex-col text-left border border-slate-700 bg-slate-800 p-6 rounded-2xl w-80 hover:border-blue-500 hover:ring-2 ring-blue-500/50 transition-all cursor-pointer group relative"
        >
          {p.isCustom && (
            <span className="absolute top-4 right-4 bg-blue-600 border border-blue-400 text-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              Custom
            </span>
          )}
          <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors pr-12">{p.name}</h3>
          <span className="text-sm font-medium text-blue-500 mb-4">{p.role}</span>
          <div className="bg-slate-900/50 p-4 rounded-lg flex-grow border border-slate-700/50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Context Snippet</span>
            <p className="text-sm text-slate-300 italic">"{p.history}"</p>
          </div>
        </button>
      ))}

      {/* Create New Button */}
      <button
        onClick={onCreateNew}
        className="flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-600 bg-slate-800/30 p-6 rounded-2xl w-80 min-h-[220px] hover:border-blue-500 hover:bg-slate-800/80 transition-all cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-300 group-hover:text-white">Create New Persona</h3>
        <p className="text-sm text-slate-500 mt-2">Create any type of AI persona</p>
      </button>
    </div>
  );
}

export type { Persona };
