import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME ?? '[Brand]';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark" aria-hidden="true">{BRAND_NAME.replace(/\W/g, '')[0] ?? 'C'}</span>
        <h1>Sign in to your CRM</h1>
        <p className="muted">All leads from every source in one place</p>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" required autoFocus value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
