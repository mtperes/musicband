import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import './WorkspacePortals.css';

export default function AuthConfirm() {
  const navigate = useNavigate();
  const [link] = useState(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    return {
      token: fragment.get('token_hash') ?? query.get('token_hash'),
      type: fragment.get('type') ?? query.get('type'),
      destination: (fragment.get('next') ?? query.get('next')) === 'admin' ? '/admin' : '/music',
    };
  });
  const verification = useRef<Promise<string | null> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    window.history.replaceState(null, '', '/auth/confirm');
    if (!verification.current) {
      verification.current = (async () => {
        if (!supabase) return 'Supabase indisponível.';
        if (!link.token || !['email', 'invite'].includes(link.type ?? '')) return 'Link de acesso inválido. Peça um novo link.';
        try {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.token, type: link.type as 'email' | 'invite' });
          return verifyError ? 'Este link expirou ou já foi utilizado. Peça um novo link de acesso.' : null;
        } catch { return 'Não foi possível verificar o link. Verifique a ligação e peça um novo link.'; }
      })();
    }
    void verification.current.then((result) => {
      if (!active) return;
      if (result) setError(result);
      else navigate(link.destination, { replace: true });
    });
    return () => { active = false; };
  }, [link, navigate]);

  return <main className="workspace min-h-screen bg-[#f3f6f5] px-4 py-16 text-[#182628]">
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">{error ? 'Acesso não confirmado' : 'A confirmar acesso...'}</h1>
      <p role={error ? 'alert' : 'status'} className="mt-4 text-[#52625f]">{error || 'A verificar o seu link.'}</p>
      {error && <Link to={link.destination} className="mt-6 inline-block underline underline-offset-4">Voltar ao acesso</Link>}
    </div>
  </main>;
}