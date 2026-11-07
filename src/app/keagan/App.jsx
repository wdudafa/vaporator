'use client';

import { useEffect, useState } from 'react';
import Landing from './components/Landing';
import Library from './components/Library';

// The username lives in the page URL (?u=name) so refreshing or sharing the link keeps the results.
function usernameFromUrl() {
  return new URLSearchParams(window.location.search).get('u');
}

function setUrlUsername(name) {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set('u', name);
  else url.searchParams.delete('u');
  window.history.pushState({}, '', url);
}

export default function App() {
  const [username, setUsername] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUsername(usernameFromUrl());
    setReady(true);

    const onBack = () => setUsername(usernameFromUrl());
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function lookUp(name) {
    setUrlUsername(name);
    setUsername(name);
    window.scrollTo(0, 0);
  }

  function reset() {
    setUrlUsername(null);
    setUsername(null);
  }

  if (!ready) return <div className="boot" />;
  if (username) return <Library key={username} username={username} onReset={reset} />;
  return <Landing onSubmit={lookUp} />;
}