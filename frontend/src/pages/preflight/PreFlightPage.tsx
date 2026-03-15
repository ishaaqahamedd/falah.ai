import React, { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';
import { ContextUploader } from '../../features/context/ContextUploader';

interface PreFlightPageProps {
  persona: any;
  onStart: (transcript: string) => void;
  onBack: () => void;
}

export function PreFlightPage({ persona, onStart, onBack }: PreFlightPageProps) {
  const [transcript, setTranscript] = useState("");
  const [briefing, setBriefing] = useState<any>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  const isCustomPersona = persona.isCustom || (persona.id && persona.id.length > 10);

  useEffect(() => {
    if (isCustomPersona) {
      fetchBriefing(false);
    }
  }, [persona.id]);

  const fetchBriefing = async (forceRefresh = true) => {
    if (!isCustomPersona) return;
    setLoadingBriefing(true);
    try {
      const res = await apiClient.get(`/context/briefing`, {
        params: { persona_id: persona.id, force_refresh: forceRefresh }
      });
      setBriefing(res.data);
    } catch (e) {
      console.error("Briefing fetch failed:", e);
    } finally {
      setLoadingBriefing(false);
    }
  };

  return (
    <div className="flex flex-col h-full flex-grow">
      <div className="flex-none p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition">
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold text-white">Preparation Room</h2>
        </div>
        <div className="text-sm px-4 py-2 bg-slate-800 rounded-full border border-slate-700 text-white">Target: <span className="font-bold text-blue-400">{persona.name}</span></div>
      </div>

      <div className="flex-grow p-8 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto">
        {/* Column 1: Profile + Context Upload */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-300">Target Profile</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
              <h4 className="font-bold text-xl text-white">{persona.name}</h4>
              <p className="text-blue-400 text-sm mb-4">{persona.role}</p>
              <p className="text-sm text-slate-300">{persona.history}</p>
            </div>
          </div>

          {isCustomPersona && (
            <ContextUploader
              personaId={persona.id}
              onUploadComplete={fetchBriefing}
            />
          )}
        </div>

        {/* Column 2: System Context + Briefing */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-300">System Context Injection</h3>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Passed to Live API</span>
          </div>

          <div className="relative h-40">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste previous email threads, notes, or specific objections you've encountered with this client..."
              className="w-full h-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-inner"
            />
          </div>

          {/* AI Briefing Panel */}
          {isCustomPersona && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-400">
                  AI Pre-Call Briefing
                  {briefing?.cached && <span className="ml-2 text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">cached</span>}
                </h3>
                <button
                  onClick={() => fetchBriefing(true)}
                  disabled={loadingBriefing}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition font-medium"
                >
                  {loadingBriefing ? 'Generating...' : briefing ? 'Regenerate' : 'Generate Briefing'}
                </button>
              </div>

              <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-xl p-4 min-h-[80px] max-h-[300px] overflow-y-auto">
                {briefing ? (
                  <>
                    <p className="text-sm text-indigo-200 leading-relaxed whitespace-pre-line">{briefing.briefing}</p>
                    {briefing.sources > 0 && (
                      <p className="text-xs text-indigo-400 mt-2 border-t border-indigo-800/30 pt-2">
                        Based on {briefing.sources} uploaded document{briefing.sources > 1 ? 's' : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-indigo-400/60 italic">Upload documents and click "Generate Briefing" to get an AI-powered pre-call summary.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Checks + Start */}
        <div className="space-y-6 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-300">Session Info</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Audio + Vision enabled</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-300">Context will be injected on connect</span>
              </div>
              {isCustomPersona && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-slate-300">Vector DB context search active</span>
                </div>
              )}
              <div className="flex items-center space-x-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span className="text-slate-300">Adaptive questioning enabled</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onStart(transcript)}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all transform hover:-translate-y-1 relative overflow-hidden group"
          >
            <span className="relative z-10">Start Live Connect Session</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      </div>
    </div>
  );
}
