import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../features/auth/api';
import { useUserStore } from '../../entities/user/store';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const img = new Image();
    img.src = '/auth/auth-img.png';
    img.onload = () => {
      setImageLoaded(true);
      setTimeout(() => setShowForm(true), 400);
    };
    img.onerror = () => {
      setImageLoaded(true);
      setShowForm(true);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-100 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: "url('/auth/auth-img.png')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Form Card */}
      <div className={`relative z-10 max-w-md w-full bg-white/90 dark:bg-surface-secondary/70 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 transition-all duration-1500 ease-out ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="p-8">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-2">Falah.ai</h2>
          <p className="text-center text-sm mb-8">AI Pitch Simulator</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
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
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex justify-center items-center"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-text-secondary text-sm">
            Don't have an account?{' '}
            <button onClick={() => navigate('/signup')} className="text-blue-500 hover:text-blue-400 transition-colors font-medium">
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
