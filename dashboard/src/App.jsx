import { useEffect, useState } from 'react';
import OverviewView from './components/OverviewView.jsx';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import {
  ExternalIcon,
  FlameIcon,
  GridIcon,
  LogoIcon,
  LogOutIcon,
  UsersIcon,
} from './components/Icons.jsx';
import { api, AUTH_EXPIRED_EVENT, tokenStore } from './api.js';

const NAV = [
  { id: 'overview', label: 'Overview', Icon: GridIcon },
  { id: 'sessions', label: 'Sessions', Icon: UsersIcon },
  { id: 'heatmap', label: 'Heatmap', Icon: FlameIcon },
];

// The demo store is served by the same backend as the API.
const DEMO_URL = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/demo/`;

export default function App() {
  const [view, setView] = useState('overview');
  const [heatmapPage, setHeatmapPage] = useState('');
  // 'checking' | 'login' | 'ready'
  const [auth, setAuth] = useState('checking');
  const [authRequired, setAuthRequired] = useState(false);
  const [expired, setExpired] = useState(false);
  const [authError, setAuthError] = useState('');

  const checkAuth = () => {
    setAuthError('');
    setAuth('checking');
    api
      .authStatus()
      .then(({ required, authenticated }) => {
        setAuthRequired(required);
        setAuth(authenticated ? 'ready' : 'login');
      })
      .catch((e) => setAuthError(e.message));
  };

  useEffect(checkAuth, []);

  useEffect(() => {
    const onExpired = () => {
      setExpired(true);
      setAuth('login');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const logout = () => {
    tokenStore.set(null);
    setExpired(false);
    setAuth('login');
  };

  const openHeatmap = (pageUrl) => {
    setHeatmapPage(pageUrl);
    setView('heatmap');
  };

  if (authError) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Can't reach the server</h1>
          <p className="login-sub">{authError}</p>
          <button type="button" className="btn primary block" onClick={checkAuth}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (auth === 'checking') {
    return (
      <div className="login-page">
        <div className="loader" aria-label="Loading" />
      </div>
    );
  }

  if (auth === 'login') {
    return (
      <LoginScreen
        expired={expired}
        onLogin={() => {
          setExpired(false);
          setAuth('ready');
        }}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <LogoIcon width={18} height={18} />
          </span>
          <div>
            <div className="brand-name">User Analytics</div>
            <div className="brand-sub">Sessions &amp; click tracking</div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Views">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'nav-item active' : 'nav-item'}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                if (id === 'heatmap') setHeatmapPage('');
                setView(id);
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <a className="nav-item" href={DEMO_URL} target="_blank" rel="noreferrer">
            <ExternalIcon />
            <span>Demo store</span>
          </a>
          {authRequired && (
            <button type="button" className="nav-item" onClick={logout}>
              <LogOutIcon />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </aside>

      <main className="content">
        {view === 'overview' && <OverviewView onOpenHeatmap={openHeatmap} />}
        {view === 'sessions' && <SessionsView />}
        {view === 'heatmap' && <HeatmapView key={heatmapPage} initialPage={heatmapPage} />}
      </main>
    </div>
  );
}
