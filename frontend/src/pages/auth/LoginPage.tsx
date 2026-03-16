import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../../features/auth/GoogleSignInButton';

export const LoginPage = () => {
  const [error, setError] = useState('');
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
          <p className="text-center text-sm mb-8">Build AI Agents. Master Any Conversation.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <GoogleSignInButton
            onSuccess={() => navigate('/')}
            onError={(msg) => setError(msg)}
          />
        </div>
      </div>
    </div>
  );
};
