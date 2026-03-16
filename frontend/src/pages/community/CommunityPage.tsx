import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPersonaTemplates, createPersona, getCommunityPersonas } from '../../features/personas/api';
import { SearchInput } from '../../shared/ui/SearchInput';
import { PreFlightDrawer } from '../../widgets/preflight-drawer/PreFlightDrawer';
import { AgentPreviewDrawer } from '../../widgets/agent-preview-drawer/AgentPreviewDrawer';
import { useUserStore } from '../../entities/user/store';

export function CommunityPage() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [templates, setTemplates] = useState<any[]>([]);
  const [communityAgents, setCommunityAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);

  // Preview drawer state
  const [previewAgent, setPreviewAgent] = useState<any>(null);
  const [previewVariant, setPreviewVariant] = useState<'template' | 'community'>('template');
  const [previewIsOwn, setPreviewIsOwn] = useState(false);

  // PreFlight drawer state (community agent → start session)
  const [selectedPersona, setSelectedPersona] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCommunityAgents();
  }, [search, typeFilter]);

  const loadData = async () => {
    try {
      const [templateData, communityData] = await Promise.all([
        getPersonaTemplates(),
        getCommunityPersonas(),
      ]);
      setTemplates(templateData);
      setCommunityAgents(communityData);
    } catch (e) {
      console.error('Failed to load community data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityAgents = async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const data = await getCommunityPersonas(Object.keys(params).length ? params : undefined);
      setCommunityAgents(data);
    } catch (e) {
      console.error('Failed to load community agents:', e);
    }
  };

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
      setPreviewAgent(null);
      navigate('/agents');
    } catch (e) {
      console.error('Failed to clone template:', e);
    } finally {
      setCloning(null);
    }
  };

  const handleUseCommunityAgent = (agent: any) => {
    setPreviewAgent(null);
    setSelectedPersona({ ...agent, isCommunityAgent: true });
  };

  const openTemplatePreview = (template: any) => {
    setPreviewAgent(template);
    setPreviewVariant('template');
    setPreviewIsOwn(false);
  };

  const openCommunityPreview = (agent: any, isOwn: boolean) => {
    setPreviewAgent(agent);
    setPreviewVariant('community');
    setPreviewIsOwn(isOwn);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-blue-500 animate-pulse font-medium">Loading community agents...</span>
      </div>
    );
  }

  // Extract unique types from community agents for filter tags
  const communityTypes = [...new Set(communityAgents.map((a) => a.type).filter(Boolean))];

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Community Agents</h1>
        <p className="text-text-secondary mt-1">Discover agents shared by the community or start with a template</p>
      </div>

      {/* Starter Templates Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Starter Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t) => (
            <div
              key={t.key || t.name}
              onClick={() => openTemplatePreview(t)}
              className="bg-surface-secondary border border-border-primary rounded-xl p-6 flex flex-col cursor-pointer hover:border-blue-500 transition-all"
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted hover:text-text-secondary transition-colors">View Details →</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUseTemplate(t); }}
                    disabled={cloning === (t.key || t.name)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    {cloning === (t.key || t.name) ? 'Adding...' : 'Add to My Agents'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Community Agents Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Shared by Community</h2>

        {/* Search + Tags */}
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search community agents..."
            className="w-72"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setSearch(''); setTypeFilter(''); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !search && !typeFilter ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-text-secondary hover:bg-border-primary'
              }`}
            >
              All
            </button>
            {communityTypes.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === type ? 'bg-blue-600 text-white' : 'bg-surface-tertiary text-text-secondary hover:bg-border-primary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Community Grid */}
        {communityAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {communityAgents.map((agent) => {
              const isOwn = user?.id === agent.user_id;
              return (
                <div
                  key={agent.id}
                  onClick={() => openCommunityPreview(agent, isOwn)}
                  className="bg-surface-secondary border border-border-primary rounded-xl p-6 flex flex-col cursor-pointer hover:border-blue-500 transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-text-primary text-lg">{agent.name}</h3>
                      <p className="text-sm text-blue-500">{agent.role}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 uppercase tracking-wider">
                      {agent.type}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary flex-1 mb-4 line-clamp-3">{agent.personality}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-text-muted">
                        by {isOwn ? 'you' : agent.creator_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">Voice: {agent.voice}</span>
                        {agent.use_count > 0 && (
                          <span className="text-xs text-text-muted">&middot; {agent.use_count} uses</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted hover:text-text-secondary transition-colors">View Details →</span>
                      {!isOwn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUseCommunityAgent(agent); }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors cursor-pointer"
                        >
                          Use This Agent
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-text-secondary">
              {search || typeFilter ? 'No community agents match your search' : 'No community agents shared yet — be the first!'}
            </p>
          </div>
        )}
      </div>

      {/* Agent Preview Drawer */}
      <AgentPreviewDrawer
        isOpen={!!previewAgent}
        onClose={() => setPreviewAgent(null)}
        agent={previewAgent}
        variant={previewVariant}
        onAction={() => {
          if (previewVariant === 'template') {
            handleUseTemplate(previewAgent);
          } else {
            handleUseCommunityAgent(previewAgent);
          }
        }}
        actionLoading={!!cloning}
        hideAction={previewIsOwn}
      />

      {/* PreFlight Drawer for community agents */}
      {selectedPersona && (
        <PreFlightDrawer
          isOpen={!!selectedPersona}
          onClose={() => setSelectedPersona(null)}
          persona={selectedPersona}
        />
      )}
    </div>
  );
}
