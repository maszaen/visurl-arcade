import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Q-Learning Games | VisuRL Arcade',
  description:
    'Platform arcade game Reinforcement Learning berbasis Q-Learning & Deep Q-Networks dengan antarmuka perangkat keras FL Studio DAW.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased min-h-screen bg-[var(--bg)] text-[var(--tx)]">
        {children}
      </body>
    </html>
  );
}
