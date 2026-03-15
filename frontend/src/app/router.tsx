import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { ProtectedRoute } from './ProtectedRoute';
import App from '../App';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <App /> }
    ]
  }
]);
