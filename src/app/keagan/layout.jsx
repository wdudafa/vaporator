import { Bricolage_Grotesque } from 'next/font/google';
import './styles.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata = {
  title: 'Vaporator',
  description: 'See how much of your Steam library has evaporated.',
};

export default function KeaganLayout({ children }) {
  return <div className={`${bricolage.className} ${bricolage.variable}`}>{children}</div>;
}