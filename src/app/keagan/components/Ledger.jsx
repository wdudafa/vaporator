// A receipt-style list of games with a playtime bar under each one.
function swatch(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 32% 58%)`;
}

export default function Ledger({ title, rows, tilted = false }) {
  const most = Math.max(1, ...rows.map((r) => r.hours));

  return (
    <div className={`ledger-wrap${tilted ? ' ledger-wrap--tilted' : ''}`}>
      <figure className="ledger">
        <figcaption className="ledger__title">{title}</figcaption>
        <ul className="ledger__rows">
          {rows.map((row) => (
            <li key={row.appId ?? row.name} className="ledger__row">
              {row.icon ? (
                <img className="ledger__icon" src={row.icon} alt="" loading="lazy" />
              ) : (
                <span className="ledger__icon" style={{ background: swatch(row.name) }} />
              )}
              <span className="ledger__name">
                {row.name}
                <span
                  className="ledger__bar"
                  style={{ '--w': `${Math.max(2, (row.hours / most) * 100)}%` }}
                />
              </span>
              <span className="ledger__hours">{row.hours} h</span>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}