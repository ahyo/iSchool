import type { Settings } from '@/lib/types';

/** Petunjuk transfer ke rekening sekolah (diatur di Pengaturan › Profil Sekolah). */
export function BankInfo({ settings }: { settings?: Pick<Settings, 'bank_name' | 'bank_account' | 'bank_holder'> | null }) {
  if (!settings?.bank_account) {
    return <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Nomor rekening sekolah belum diatur. Hubungi bagian keuangan sekolah sebelum melakukan transfer.</p>;
  }
  return (
    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
      Transfer ke <b>{settings.bank_name}</b><br />No. rekening <b className="font-mono">{settings.bank_account}</b> a.n. {settings.bank_holder}
    </p>
  );
}
