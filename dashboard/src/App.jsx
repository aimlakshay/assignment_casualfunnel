import { useState } from 'react';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';
import { FlameIcon, LogoIcon, UsersIcon } from './components/Icons.jsx';

const TABS = [
  { id: 'sessions', label: 'Sessions', Icon: UsersIcon },
  { id: 'heatmap', label: 'Heatmap', Icon: FlameIcon },
];

export default function App() {
  const [tab, setTab] = useState('sessions');

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <LogoIcon width={18} height={18} />
            </span>
            <div>
              <div className="brand-name">User Analytics</div>
              <div className="brand-sub">Sessions &amp; click tracking</div>
            </div>
          </div>

          <nav className="segmented" aria-label="Views">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={tab === id ? 'seg active' : 'seg'}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="content">{tab === 'sessions' ? <SessionsView /> : <HeatmapView />}</main>
    </div>
  );
}
