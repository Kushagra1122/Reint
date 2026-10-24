import { ExternalLink } from 'lucide-react'

export function Methodology() {
  return <div className="page-stack">
    <header className="page-header"><div><h1>Method</h1><p>Data sources, selection rules, and limitations.</p></div></header>
    <section className="method-hero panel">
      <div><p className="eyebrow">Core guarantee</p><h2>No future forecast revision is allowed into a historical decision.</h2><p>The primary view reconstructs exactly which vintage was available at the chosen cutoff. Later updates remain visible only in the revision explorer.</p></div>
      <pre><code><span>eligible</span> = publishTime ≤ cutoff{`\n`}           and publishTime &lt; startTime{`\n\n`}<span>selected</span> = max(eligible, key=publishTime)</code></pre>
    </section>
    <section className="method-grid">
      <article className="panel method-card"><h2>Elexon only</h2><p><strong>WINDFOR</strong> supplies every historical forecast vintage. <strong>FUELHH</strong>, filtered to WIND, supplies generation outturn.</p><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">WINDFOR documentation <ExternalLink size={14}/></a><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">FUELHH documentation <ExternalLink size={14}/></a></article>
      <article className="panel method-card"><h2>Exact timestamps</h2><p>The January WINDFOR snapshot has hourly targets; FUELHH is half-hourly. Only equal <code>startTime</code> values are compared.</p><ul><li>No interpolation</li><li>No missing-as-zero</li><li>UTC internally; GMT labels in January</li></ul></article>
      <article className="panel method-card"><h2>Forecast − actual</h2><p>A positive signed error is an <strong>overforecast</strong>: observed wind was lower than forecast. This may indicate additional procurement exposure.</p><div className="formula">eᵢ = Fᵢ − Aᵢ</div></article>
      <article className="panel method-card"><h2>Illustrative cutoff</h2><p>11:00 Europe/London is a configurable demonstration assumption. It is not presented as an official UK day-ahead market close.</p></article>
    </section>
    <section className="two-column equal">
      <article className="panel prose-panel"><p className="eyebrow">Date interpretation</p><h2>Decision month, not delivery month</h2><p>The selectable dates are <strong>1–31 January 2026</strong> purchase decisions. Each targets the following delivery day: <strong>2 January–1 February</strong>. A 31 December decision is therefore outside this primary view.</p><dl className="audit-list"><div><dt>Decision dates</dt><dd>01–31 Jan 2026</dd></div><div><dt>Delivery dates</dt><dd>02 Jan–01 Feb 2026</dd></div><div><dt>Default cutoff</dt><dd>11:00 Europe/London</dd></div></dl></article>
      <article className="panel prose-panel"><p className="eyebrow">Risk methodology</p><h2>Historical error band</h2><p>When at least 24 preceding matched observations were available at the historical cutoff, the decision chart applies empirical 5th and 95th percentiles of signed error:</p><div className="formula">[ F − q₉₅(e), F − q₀₅(e) ]</div><p>This is a descriptive historical range—not a calibrated 90% prediction interval.</p></article>
    </section>
    <section className="panel limitations"><p className="eyebrow">Material limitations</p><h2>Read before using the comparison</h2><div className="limitation-grid"><p><span>01</span>WINDFOR forecasts the wind farms visible to ESO with operational metering, while FUELHH reports wind outturn by fuel type. Their asset coverage may differ.</p><p><span>02</span>Metrics describe forecast error only. Without demand, contracted supply, market price, and portfolio constraints, this app cannot recommend a trade quantity.</p><p><span>03</span>The cached snapshot is reproducible but not live. The health endpoint and import ledger expose its refresh state.</p></div></section>
  </div>
}
