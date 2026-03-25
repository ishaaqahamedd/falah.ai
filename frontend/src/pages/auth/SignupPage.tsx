import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../../features/auth/GoogleSignInButton';

export const SignupPage = () => {
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
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: "url('/auth/auth-img.png')" }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Form Card */}
      <div className={`relative z-10 max-w-md w-full bg-white/90 dark:bg-surface-secondary/90 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 transition-all duration-700 ease-out ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="p-8">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-2">Falah.ai</h2>
          <p className="text-text-muted text-center text-sm mb-8">Create your account</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <GoogleSignInButton
            onSuccess={() => navigate('/')}
            onError={(msg) => setError(msg)}
          />

          <div className="mt-6 text-center text-text-secondary text-sm">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-blue-500 hover:text-blue-400 transition-colors font-medium">
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
