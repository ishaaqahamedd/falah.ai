import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPersonaTemplates, createPersona } from '../../features/personas/api';
import { SearchInput } from '../../shared/ui/SearchInput';

export function CommunityPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getPersonaTemplates();
      setTemplates(data);
      setFiltered(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!search) {
      setFiltered(templates);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      templates.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.role?.toLowerCase().includes(q) ||
          t.type?.toLowerCase().includes(q)
      )
    );
  }, [search, templates]);

  const handleUseTemplate = async (template: any) => {
    setCloning(template.key || template.name);
    try {
      const payload: Record<string, unknown> = {
        type: template.type,
        name: template.name,
        role: template.role,
        personality: template.personality,
        focus_areas: template.focus_areas,
        voice: template.voice || 'Puck',
      };
      if (template.scoring_criteria?.length > 0) payload.scoring_criteria = template.scoring_criteria;
      if (template.behavior_rules?.length > 0) payload.behavior_rules = template.behavior_rules;
      if (template.opening_message) payload.opening_message = template.opening_message;

      await createPersona(payload);
      navigate('/agents');
    } catch (e) {
      console.error('Failed to clone template:', e);
    } finally {
      setCloning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-blue-500 animate-pulse font-medium">Loading community agents...</span>
      </div>
    );
  }

  // Extract unique types for filter tags
  const types = [...new Set(templates.map((t) => t.type).filter(Boolean))];

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Community Agents</h1>
        <p className="text-text-secondary mt-1">Ready-to-use agent templates — pick one and start practicing instantly</p>
      </div>

      {/* Search + Tags */}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search agents..."
          className="w-72"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSearch('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !search ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-text-secondary hover:bg-border-primary'
            }`}
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setSearch(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                search === type ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-text-secondary hover:bg-border-primary'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((t) => (
          <div
            key={t.key || t.name}
            className="bg-surface-secondary border border-border-primary rounded-xl p-6 flex flex-col"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-text-primary text-lg">{t.name}</h3>
                <p className="text-sm text-blue-500">{t.role}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-tertiary text-text-muted uppercase tracking-wider">
                {t.type}
              </span>
            </div>
            <p className="text-sm text-text-secondary flex-1 mb-4 line-clamp-3">{t.personality}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Voice: {t.voice || 'Puck'}</span>
              <button
                onClick={() => handleUseTemplate(t)}
                disabled={cloning === (t.key || t.name)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {cloning === (t.key || t.name) ? 'Adding...' : 'Use This Agent'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-secondary">No templates match your search</p>
        </div>
      )}
    </div>
  );
}
