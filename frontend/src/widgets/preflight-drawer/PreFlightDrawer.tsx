import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../../shared/ui/Drawer';
import { ContextUploader } from '../../features/context/ContextUploader';
import { apiClient } from '../../shared/api/client';
import type { Briefing } from '@shared/types';

interface PreFlightPersona {
  id: string;
  name: string;
  role: string;
  creator_name?: string;
  isCommunityAgent?: boolean;
  isCustom?: boolean;
}

interface PreFlightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PreFlightPersona;
}

export function PreFlightDrawer({ isOpen, onClose, persona }: PreFlightDrawerProps) {
  const navigate = useNavigate();
  const [context, setContext] = useState('');
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);

  const isCommunityAgent = persona?.isCommunityAgent === true;
  const isCustomPersona = !isCommunityAgent && (persona?.isCustom || (persona?.id && persona.id.length > 10));

  // Enumerate audio devices when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    const loadDevices = async () => {
      try {
        // Request mic permission first so device labels are populated
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(d => d.kind === 'audioinput' && d.deviceId);
        const speakers = devices.filter(d => d.kind === 'audiooutput' && d.deviceId);
        setAudioDevices(mics);
        setSpeakerDevices(speakers);
        if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId);
        if (speakers.length > 0 && !selectedSpeakerId) setSelectedSpeakerId(speakers[0].deviceId);
      } catch (e) {
        console.warn('Could not enumerate audio devices:', e);
      }
    };
    loadDevices();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isCustomPersona) {
      fetchBriefing(false);
    }
  }, [isOpen, persona?.id]);

  const fetchBriefing = async (forceRefresh = true) => {
    if (!isCustomPersona) return;
    setLoadingBriefing(true);
    try {
      const res = await apiClient.get('/context/briefing', {
        params: { persona_id: persona.id, force_refresh: forceRefresh },
      });
      setBriefing(res.data);
    } catch (e) {
      console.error('Briefing fetch failed:', e);
    } finally {
      setLoadingBriefing(false);
    }
  };

  const handleStart = () => {
    // Add environment prefix for agent worker filtering
    // Read from VITE_ENVIRONMENT or fall back to MODE
    const env = (import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'local').split('-')[0];
    const roomName = `${env}-session-${persona.id}-${Date.now()}`;
    onClose();
    navigate(`/live/${roomName}`, {
      state: { persona, context, selectedMicId, selectedSpeakerId },
    });
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Preparation Room">
      <div className="space-y-6">
        {/* Target */}
        <div className="bg-surface border border-border-primary rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
            {isCommunityAgent ? 'Community Agent' : 'Target'}
          </p>
          <h3 className="font-bold text-text-primary">{persona?.name}</h3>
          <p className="text-sm text-blue-500">{persona?.role}</p>
          {isCommunityAgent && persona?.creator_name && (
            <p className="text-xs text-text-muted mt-1">by {persona.creator_name}</p>
          )}
        </div>

        {/* Context */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text-secondary">System Context</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste previous email threads, notes, or specific context..."
            rows={4}
            className="w-full bg-surface border border-border-primary rounded-xl p-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Document Upload */}
        {isCustomPersona && (
          <ContextUploader personaId={persona.id} onUploadComplete={() => fetchBriefing(true)} />
        )}

        {/* AI Briefing */}
        {isCustomPersona && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-text-secondary">
                AI Briefing
                {briefing?.cached && (
                  <span className="ml-2 text-[10px] bg-surface-tertiary text-text-muted px-1.5 py-0.5 rounded">cached</span>
                )}
              </span>
              <button
                onClick={() => fetchBriefing(true)}
                disabled={loadingBriefing}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium"
              >
                {loadingBriefing ? 'Generating...' : briefing ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 min-h-[60px] max-h-[200px] overflow-y-auto">
              {briefing ? (
                <p className="text-sm text-indigo-300 leading-relaxed whitespace-pre-line">{briefing.briefing}</p>
              ) : (
                <p className="text-sm text-text-muted italic">Upload documents and generate a briefing.</p>
              )}
            </div>
          </div>
        )}

        {/* Audio Device Selection */}
        {audioDevices.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted uppercase tracking-wider">Audio Devices</p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">Microphone</label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full bg-surface border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
            {speakerDevices.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">Speaker</label>
                <select
                  value={selectedSpeakerId}
                  onChange={(e) => setSelectedSpeakerId(e.target.value)}
                  className="w-full bg-surface border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {speakerDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Session Checks */}
        <div className="bg-surface border border-border-primary rounded-xl p-4 space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Session Features</p>
          {['Audio + Vision enabled', 'Context injected on connect', 'Adaptive questioning'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-text-secondary">{item}</span>
            </div>
          ))}
        </div>

        {/* Start */}
        <button
          onClick={handleStart}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-colors shadow-lg"
        >
          Start Live Session
        </button>
      </div>
    </Drawer>
  );
}
