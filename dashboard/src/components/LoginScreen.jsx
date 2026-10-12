import { useState } from 'react';
import { api, tokenStore } from '../api.js';
import { EyeIcon, LockIcon, LogoIcon } from './Icons.jsx';

export default function LoginScreen({ onLogin, expired }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return setError('Enter the dashboard password');
    setSubmitting(true);
    setError('');
    try {
      const { token } = await api.login(password);
      tokenStore.set(token);
      onLogin();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <span className="brand-mark login-mark">
          <LogoIcon width={22} height={22} />
        </span>
        <h1>User Analytics</h1>
        <p className="login-sub">Enter the dashboard password to continue.</p>

        {expired && !error && (
          <p className="login-note">Your session expired. Please sign in again.</p>
        )}

        <label className="login-field">
          <span className="field-label">Password</span>
          <div className={error ? 'input-wrap invalid' : 'input-wrap'}>
            <LockIcon className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <EyeIcon />
            </button>
          </div>
        </label>

        {error && (
          <p id="login-error" className="login-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn primary block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
