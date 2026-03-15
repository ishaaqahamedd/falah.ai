import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login } from '../../features/auth/api';

export const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(email, fullName, password);
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-secondary rounded-xl shadow-xl overflow-hidden border border-border-primary">
        <div className="p-8">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-8">Create Account</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label className="block text-text-secondary text-sm mb-2">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-surface border border-border-primary rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Jane Doe"
                required
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-border-primary rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-text-secondary text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border-primary rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-text-secondary text-sm">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-blue-500 hover:text-blue-400 transition-colors">
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
