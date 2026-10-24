import { useEffect, useState } from 'react'
import { Activity, BookOpen, GitBranch, LayoutDashboard, Menu, Wind, X } from 'lucide-react'
import { getJson } from './api/client'
import { Accuracy } from './pages/Accuracy'
import { DecisionDashboard } from './pages/DecisionDashboard'
import { Methodology } from './pages/Methodology'
import { Revisions } from './pages/Revisions'

type Page = 'decision' | 'accuracy' | 'revisions' | 'methodology'
type Health = { status: string; snapshot: { forecast_rows: number; actual_rows: number; latest_import: { completed_at?: string } | null } }

const nav = [
  { id: 'decision' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'accuracy' as const, label: 'Accuracy', icon: Activity },
  { id: 'revisions' as const, label: 'Revisions', icon: GitBranch },
  { id: 'methodology' as const, label: 'Method', icon: BookOpen },
]

export default function App() {
  const [page, setPage] = useState<Page>('decision')
  const [decisionDate, setDecisionDate] = useState('2026-01-15')
  const [cutoff, setCutoff] = useState('11:00')
  const [health, setHealth] = useState<Health | null>(null)
  const [menu, setMenu] = useState(false)
  useEffect(() => { getJson<Health>('/api/health').then(setHealth).catch(() => setHealth(null)) }, [])

  const openPage = (next: Page) => { setPage(next); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Wind size={19}/></span><strong>WindSight</strong><button className="icon-button mobile-close" onClick={() => setMenu(false)} aria-label="Close menu"><X size={19}/></button></div>
      <nav aria-label="Primary navigation">
        {nav.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => openPage(item.id)}><item.icon size={17}/><span>{item.label}</span></button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="compact-status" title={health ? `${health.snapshot.forecast_rows.toLocaleString()} forecast vintages and ${health.snapshot.actual_rows.toLocaleString()} actuals` : 'Unable to reach backend'}>
          <i className={health?.status === 'ready' ? 'online' : ''}/>
          <span>{health?.status === 'ready' ? 'Elexon data ready' : health ? 'Import required' : 'API offline'}</span>
        </div>
      </div>
    </aside>
    <main>
      <div className="mobile-bar"><button className="icon-button" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={21}/></button><div className="brand"><span className="brand-mark"><Wind size={18}/></span><strong>WindSight</strong></div><span className={`health-dot ${health?.status === 'ready' ? 'online' : ''}`}/></div>
      {page === 'decision' && <DecisionDashboard decisionDate={decisionDate} cutoff={cutoff} onDecisionDate={setDecisionDate} onCutoff={setCutoff}/>} 
      {page === 'accuracy' && <Accuracy cutoff={cutoff}/>} 
      {page === 'revisions' && <Revisions decisionDate={decisionDate} cutoff={cutoff}/>} 
      {page === 'methodology' && <Methodology/>}
      <footer className="app-footer"><span>WindSight · Elexon WINDFOR + FUELHH only</span><span>All times Europe/London · generation in MW</span></footer>
    </main>
    {menu && <button className="menu-scrim" onClick={() => setMenu(false)} aria-label="Close navigation"/>}
  </div>
}
