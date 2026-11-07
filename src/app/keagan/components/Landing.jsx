import UsernameForm from './UsernameForm';
import Ledger from './Ledger';
import PickCard from './PickCard';
import Wordmark from './Wordmark';

// Invented example data for the preview on the landing page.
const SAMPLE_PLAYED = [
  { name: 'Orbital Allotment', hours: 212 },
  { name: 'Grudge Kart 3', hours: 96 },
  { name: 'Midnight Forklift', hours: 41 },
  { name: 'The Quiet Archive', hours: 18 },
];

const SAMPLE_PICK = {
  name: 'Harbour of Small Engines',
  price: '£16.99',
  tags: ['Management', 'Cosy', 'Physics'],
  reason: 'Because you played 212 hours of Orbital Allotment.',
};

export default function Landing({ onSubmit }) {
  return (
    <div className="page page--landing">
      <header className="topbar">
        <span className="topbar__mark">vaporator</span>
        <nav className="topbar__nav" aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
      </header>

      <main className="hero">
        <section className="hero__copy">
          <h1>Your next game, distilled from the ones you already play.</h1>
          <p className="hero__lede">
            Enter your Steam username and Vaporator reads your library and playtime, then
            recommends one new game it thinks you will actually play.
          </p>

          <UsernameForm onSubmit={onSubmit} />

          <p className="hero__fine" id="privacy">
            No sign-in needed. Vaporator only reads what your Steam profile shows publicly, so your
            profile and game details need to be set to Public.
          </p>
        </section>

        <aside className="hero__stack" id="how" aria-label="Example recommendation">
          <Ledger tilted title="Your most played" rows={SAMPLE_PLAYED} />
          <PickCard tilted pick={SAMPLE_PICK} label="Distilled into" showReason />
        </aside>
      </main>

      <Wordmark />
    </div>
  );
}