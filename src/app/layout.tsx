import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'BETMAN HQ',
  description: 'BETMAN Company Operating System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-slate-100">
        <NavBar />
        <main className="max-w-screen-2xl mx-auto px-4 py-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
