import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const mukta = Mukta({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mukta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SwasthyaAI',
  description: 'AI-assisted rural health screening for ASHA and ANM workers',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#123B2D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mukta.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
