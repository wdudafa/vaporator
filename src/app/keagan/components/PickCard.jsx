function hue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export default function PickCard({ pick, label, showReason = false, tilted = false, fresh = false }) {
  const classes = ['pick', tilted && 'pick--tilted', fresh && 'pick--fresh'].filter(Boolean).join(' ');

  return (
    <article className={classes}>
      <div className="pick__art" style={{ '--h': hue(pick.name) }}>
        {pick.image ? (
          <img src={pick.image} alt="" />
        ) : (
          <h3 className="pick__art-title">{pick.name}</h3>
        )}
      </div>

      <div className="pick__body">
        {label && <p className="pick__label">{label}</p>}
        {/* Without an image, the generated cover already shows the name. */}
        {pick.image && <h3 className="pick__name">{pick.name}</h3>}

        {pick.tags?.length > 0 && (
          <ul className="pick__tags">
            {pick.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}

        <div className="pick__meta">
          <span>{showReason ? pick.reason : 'On the Steam store'}</span>
          <strong>{pick.price ?? 'Free'}</strong>
        </div>
      </div>
    </article>
  );
}