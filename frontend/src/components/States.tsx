import { AlertTriangle, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading Elexon snapshot…' }: { label?: string }) {
  return <div className="state-card"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="state-card state-error">
      <AlertTriangle size={22} />
      <div><strong>Data could not be loaded</strong><p>{message}</p></div>
      {retry && <button className="button secondary" onClick={retry}>Retry</button>}
    </div>
  )
}

