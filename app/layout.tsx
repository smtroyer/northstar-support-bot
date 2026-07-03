import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'North Star Support Bot',
  description:
    'Customer support assistant for North Star Gear, an outdoor apparel and camping gear store. Demo on fictional data.',
};

export const viewport: Viewport = {
  themeColor: '#1F3D30',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
