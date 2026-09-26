import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider, WorkspaceProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui';

export const metadata: Metadata = {
  title: 'iSchool — Sistem Informasi Sekolah Terpadu',
  description: 'Sistem informasi sekolah untuk SD, SMP, SMA, dan SMK: PPDB, keuangan, presensi, akademik, dan kepegawaian.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <WorkspaceProvider>
            {children}
            <Toaster />
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
