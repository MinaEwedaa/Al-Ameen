import { ArrowLeftRight, Clock, FileText, Smartphone, Wallet } from 'lucide-react';
import { StatCard } from '../../../components/ui/StatCard';
import { getTranslation, type Language } from '../../../core/i18n';
import { PAYMENT_METHODS } from '../../../core/constants/paymentMethods';
import { STATUS } from '../../../core/constants/status';
import { formatCompactAmount } from '../utils/paymentsFormat';
import type { Payment } from '../types/payment.types';
import './PaymentsSummary.css';

interface PaymentsSummaryProps {
  payments: Payment[];
  language: Language;
}

function totalOf(payments: Payment[], method?: string): number {
  return payments
    .filter((payment) => !method || payment.method === method)
    .reduce((sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0), 0);
}

// Six cards in one row, in the order of the prototype
export function PaymentsSummary({ payments, language }: PaymentsSummaryProps) {
  const t = (key: string) => getTranslation(language, key);
  const pending = payments.filter((payment) => payment.status === STATUS.pending).length;

  return (
    <section className="payments-summary" aria-label={t('paymentsPage.stats.today')}>
      <StatCard label={t('paymentsPage.stats.today')} value={formatCompactAmount(totalOf(payments), language)} icon={<Wallet />} tone="green" />
      <StatCard label={t('paymentsPage.stats.cash')} value={formatCompactAmount(totalOf(payments, PAYMENT_METHODS.cash), language)} icon={<Wallet />} tone="green" />
      <StatCard label={t('paymentsPage.stats.instapay')} value={formatCompactAmount(totalOf(payments, PAYMENT_METHODS.card), language)} icon={<Smartphone />} tone="gold" />
      <StatCard label={t('paymentsPage.stats.pending')} value={pending} icon={<Clock />} tone="gold" />
      <StatCard label={t('paymentsPage.stats.count')} value={payments.length} icon={<ArrowLeftRight />} tone="green" />
      <StatCard label={t('paymentsPage.stats.vodafone')} value={formatCompactAmount(totalOf(payments, PAYMENT_METHODS.transfer), language)} icon={<FileText />} tone="gold" />
    </section>
  );
}
