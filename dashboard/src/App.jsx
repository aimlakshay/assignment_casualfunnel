import { useState } from 'react';
import SessionsView from './components/SessionsView.jsx';
import HeatmapView from './components/HeatmapView.jsx';

const TABS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'heatmap', label: 'Heatmap' },
];

export default function App() {
  const [tab, setTab] = useState('sessions');

  return (
    <div className="app">
      <header className="topbar">
        <h1>User Analytics</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">{tab === 'sessions' ? <SessionsView /> : <HeatmapView />}</main>
    </div>
  );
}
