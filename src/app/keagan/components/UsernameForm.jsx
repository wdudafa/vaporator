import { useState } from 'react';

// Accepts a custom URL name, a 17-digit SteamID, or a pasted profile link.
function cleanSteamInput(value) {
  const v = value.trim();
  const fromLink = v.match(/steamcommunity\.com\/(?:id|profiles)\/([^/?#]+)/i);
  return fromLink ? fromLink[1] : v.replace(/\/+$/, '');
}

export default function UsernameForm({ onSubmit }) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const name = cleanSteamInput(value);
    if (!name) {
      setProblem('Enter your Steam username or paste your profile link.');
      return;
    }
    setProblem(null);
    onSubmit(name);
  }

  return (
    <form className="lookup" onSubmit={handleSubmit} noValidate>
      <label className="lookup__label" htmlFor="steam-user">
        Steam username
      </label>
      <div className="lookup__row">
        <input
          id="steam-user"
          className="lookup__input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="yourname"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem) setProblem(null);
          }}
          aria-invalid={problem ? true : undefined}
          aria-describedby="steam-user-hint"
        />
        <button className="primary-button" type="submit">
          <svg className="primary-button__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 20c-2-3 2-5 0-8s2-5 0-8" />
            <path d="M12 20c-2-3 2-5 0-8s2-5 0-8" />
            <path d="M17 20c-2-3 2-5 0-8s2-5 0-8" />
          </svg>
          <span>Find my next game</span>
        </button>
      </div>
      <p id="steam-user-hint" className={`lookup__hint${problem ? ' is-problem' : ''}`}>
        {problem ??
          'The name at the end of your profile link: steamcommunity.com/id/yourname. You can paste the whole link too.'}
      </p>
    </form>
  );
}