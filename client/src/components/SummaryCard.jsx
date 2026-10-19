/**
 * SummaryCard — one metric tile in the dashboard grid.
 *
 * Props:
 *   label      string  — e.g. "Active Jobs"
 *   value      number  — the big displayed number
 *   icon       string  — emoji icon
 *   accentColor string  — CSS colour for the top accent bar
 *   iconBg     string  — CSS background for the icon box
 *   note       string  — small italic footnote (e.g. "placeholder value")
 */
function SummaryCard({ label, value, icon, accentColor, iconBg, note }) {
  return (
    <div className="summary-card">
      {/* Coloured top stripe */}
      <div
        className="summary-card-accent"
        style={{ background: accentColor }}
      />

      <div className="summary-card-header">
        <div>
          <p className="summary-card-label">{label}</p>
          <p className="summary-card-value">{value}</p>
          {note && <p className="summary-card-note">{note}</p>}
        </div>
        <div
          className="summary-card-icon"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

export default SummaryCard
