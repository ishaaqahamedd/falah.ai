import React, { useState } from 'react';
import './index.css';
import { useUserStore } from './entities/user/store';
import { Navbar } from './widgets/navbar/Navbar';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PreFlightPage } from './pages/preflight/PreFlightPage';
import { LivePitchPage } from './pages/live-pitch/LivePitchPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';

type Screen = 'dashboard' | 'preflight' | 'live' | 'analytics';

function App() {
  const { user, logout } = useUserStore();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [persona, setPersona] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 overflow-hidden">
      <Navbar
        title="AI Pitch Simulator"
        userName={user?.full_name}
        onLogout={logout}
        onTitleClick={() => { setPersona(null); setSessionId(null); setCurrentScreen('dashboard'); }}
      />

      {currentScreen === 'dashboard' && (
        <DashboardPage
          onSelect={(p) => { setPersona(p); setCurrentScreen('preflight'); }}
          onViewSession={(id) => { setSessionId(id); setCurrentScreen('analytics'); }}
        />
      )}

      {currentScreen === 'preflight' && (
        <PreFlightPage
          persona={persona}
          onStart={(t) => { setTranscript(t); setCurrentScreen('live'); }}
          onBack={() => setCurrentScreen('dashboard')}
        />
      )}

      {currentScreen === 'live' && (
        <LivePitchPage
          persona={persona}
          transcript={transcript}
          onEnd={() => { setSessionId(null); setCurrentScreen('analytics'); }}
        />
      )}

      {currentScreen === 'analytics' && (
        <AnalyticsPage
          sessionId={sessionId}
          onReset={() => { setPersona(null); setSessionId(null); setCurrentScreen('dashboard'); }}
        />
      )}
    </div>
  );
}

export default App;
