export default function Wordmark({ text = 'vaporator' }) {
  return (
    <div className="wordmark" aria-hidden="true">
      {[...text].map((ch, i) => (
        <span key={i} style={{ '--i': i }}>
          {ch}
        </span>
      ))}
    </div>
  );
}