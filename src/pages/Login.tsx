import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, User, Lock } from 'lucide-react';
import rhLoveLogo from '@/assets/rh-love-logo.png';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <img
          src={rhLoveLogo}
          alt="RH Love"
          className="w-[300px] md:w-[420px] mb-8"
          style={{ mixBlendMode: 'lighten' }}
        />

        {/* Heading */}
        <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo</h1>
        <p className="text-sm mb-8" style={{ color: '#999' }}>Entre com suas credenciais</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <User className="w-4 h-4" />
              Usuário
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full h-12 rounded-xl px-4 text-white text-sm outline-none transition-colors"
              style={{ backgroundColor: '#2D2D2D', border: '1px solid #444' }}
              onFocus={e => (e.target.style.borderColor = '#F97316')}
              onBlur={e => (e.target.style.borderColor = '#444')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <Lock className="w-4 h-4" />
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full h-12 rounded-xl px-4 text-white text-sm outline-none transition-colors"
              style={{ backgroundColor: '#2D2D2D', border: '1px solid #444' }}
              onFocus={e => (e.target.style.borderColor = '#F97316')}
              onBlur={e => (e.target.style.borderColor = '#444')}
            />
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input type="checkbox" className="rounded accent-orange-500" />
              Lembrar minha senha
            </label>
            <button type="button" className="text-xs font-medium hover:underline" style={{ color: '#F97316' }}>
              Esqueceu a senha?
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400 font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-white font-bold text-base transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#F97316' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
