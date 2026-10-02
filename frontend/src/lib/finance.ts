import type { Bill, Payment } from './types';

/** Hanya pembayaran terverifikasi yang dihitung sebagai pemasukan / pelunasan. */
export const isVerified = (p: Pick<Payment, 'status'>) => !p.status || p.status === 'terverifikasi';

export const pendingFor = (billId: number, payments: Payment[]) => payments.filter((p) => p.bill_id === billId && p.status === 'menunggu');

/** Sisa tagihan yang masih bisa diajukan (dikurangi pembayaran yang menunggu verifikasi). */
export function payableRemaining(bill: Bill, payments: Payment[]) {
  return bill.amount - bill.discount - bill.paid_amount - pendingFor(bill.id, payments).reduce((a, p) => a + p.amount, 0);
}
