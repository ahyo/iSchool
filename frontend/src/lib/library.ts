import type { Book, BookLoan, BookReservation } from './types';
import { today } from './utils';

export const LIB_STAFF = ['admin', 'pustakawan'];

const dayDiff = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

/** Hari keterlambatan: sejak jatuh tempo sampai dikembalikan (atau hari ini bila belum kembali). */
export function lateDays(loan: Pick<BookLoan, 'due_date' | 'returned_at'>, asOf = today()) {
  return Math.max(0, dayDiff(loan.due_date, loan.returned_at || asOf));
}

export type LoanStatus = 'dipinjam' | 'terlambat' | 'kembali';
export function loanStatus(loan: BookLoan, asOf = today()): LoanStatus {
  if (loan.returned_at) return 'kembali';
  return loan.due_date < asOf ? 'terlambat' : 'dipinjam';
}

/** Denda: tersimpan saat dikembalikan; untuk pinjaman aktif dihitung berjalan. */
export function loanFine(loan: BookLoan, finePerDay: number) {
  return loan.returned_at ? loan.fine : lateDays(loan) * finePerDay;
}

export function availableCopies(book: Book, loans: BookLoan[]) {
  return book.copies - loans.filter((l) => l.book_id === book.id && !l.returned_at).length;
}

export function pendingReservations(bookId: number, reservations: BookReservation[]) {
  return reservations.filter((r) => r.book_id === bookId && r.status === 'menunggu');
}
