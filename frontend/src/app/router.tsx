import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LiveLayout } from './layouts/LiveLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { AgentsPage } from '../pages/agents/AgentsPage';
import { AgentDetailPage } from '../pages/agents/AgentDetailPage';
import { SessionsPage } from '../pages/sessions/SessionsPage';
import { SessionDetailPage } from '../pages/sessions/SessionDetailPage';
import { CommunityPage } from '../pages/community/CommunityPage';
import { ConnectorsPage } from '../pages/connectors/ConnectorsPage';
import { LivePitchPage } from '../pages/live-pitch/LivePitchPage';

export const router = createBrowserRouter([
  // Public auth routes
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },

  // Protected app routes
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      // Main app layout with TopBar + Dock
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/agents" replace /> },
          { path: 'agents', element: <AgentsPage /> },
          { path: 'agents/:id', element: <AgentDetailPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'sessions/:id', element: <SessionDetailPage /> },
          { path: 'community', element: <CommunityPage /> },
          { path: 'connectors', element: <ConnectorsPage /> },
        ],
      },
      // Fullscreen live session layout (no dock)
      {
        element: <LiveLayout />,
        children: [
          { path: 'live/:roomName', element: <LivePitchPage /> },
        ],
      },
    ],
  },
]);
