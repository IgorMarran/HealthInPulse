import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '@/contexts/AuthContext';
import { Eye, EyeOff, Heart, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiError } from '@/services/api';

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const from       = location.state?.from?.pathname || null;

  // Abre vazio: nenhum login é sugerido pelo app
  const [form, setForm]       = useState({ username: '', password: '' });
  const [show, setShow]       = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef           = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error('Preencha usuário e senha');
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      navigate(from || homeFor(user), { replace: true });
    } catch (err) {
      toast.error(apiError(err, 'Usuário ou senha inválidos'));
      // Mantém o usuário digitado; limpa só a senha e volta o foco para ela
      setForm((f) => ({ ...f, password: '' }));
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-50 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-50 mb-4">
            <Heart size={22} className="text-brand-700" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Health<span className="text-brand-700">InPulse</span>
          </h1>
          <p className="text-surface-500 text-sm mt-1">Saúde digital · Care Plus</p>
        </div>

        {/* Card */}
        <div className="glass p-6">
          <h2 className="font-display text-lg font-semibold mb-5">Entrar</h2>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <div>
              <label className="label" htmlFor="login-username">Usuário</label>
              <input
                id="login-username" name="hip-username"
                value={form.username} onChange={set('username')}
                className="input" placeholder="seu usuário"
                autoComplete="off" autoCapitalize="none" spellCheck={false}
              />
            </div>
            <div>
              <label className="label" htmlFor="login-password">Senha</label>
              <div className="relative">
                <input
                  id="login-password" name="hip-password" ref={passwordRef}
                  type={show ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  className="input pr-10" placeholder="••••••••"
                  autoComplete="off"
                />
                <button
                  type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-500"
                  aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Teste rápido do stand: público, sem login */}
        <Link
          to="/teste"
          className="glass mt-4 p-4 flex items-center gap-3 hover:border-brand-300 hover:bg-brand-50/40 transition-all group"
        >
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
            <ClipboardCheck size={16} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-surface-800">Teste rápido de prevenção</span>
            <span className="block text-[11px] text-surface-500">2 a 3 minutos, sem login, nada é gravado</span>
          </span>
          <span className="text-surface-300 group-hover:text-brand-600 transition-colors">→</span>
        </Link>

        <p className="text-center text-surface-400 text-sm mt-4">
          Não tem conta?{' '}
          <Link to="/register" className="text-brand-700 hover:text-brand-800">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
