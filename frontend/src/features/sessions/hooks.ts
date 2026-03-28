import { useState, useEffect } from 'react';
import { getSessions, getSession } from './api';
import type { Session } from '@shared/types';

export function useSessionTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return elapsedSeconds;
}

export function useSessionLoader(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    setLoading(true);
    try {
      if (sessionId) {
        const data = await getSession(sessionId);
        setSession(data);
      } else {
        const sessions = await getSessions(null, 1);
        if (sessions.length > 0) {
          const data = await getSession(sessions[0].id);
          setSession(data);
        }
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  return { session, setSession, loading, reload: loadSession };
}
