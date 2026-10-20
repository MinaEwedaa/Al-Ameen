import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { PageHero } from '../../../components/common/PageHero';
import { TableCard } from '../../../components/common/TableCard';
import { useToast } from '../../../components/common/toast.context';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Pagination } from '../../../components/ui/Pagination';
import { Table } from '../../../components/ui/Table';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getTranslation, type Language } from '../../../core/i18n';
import { toDayKey } from '../../../core/utils/date';
import { usePagination } from '../../../hooks/usePagination';
import { formatNumber } from '../../../utils/format';
import { AddPaymentDrawer } from '../components/AddPaymentDrawer';
import { PaymentDetailsDrawer } from '../components/PaymentDetailsDrawer';
import { PaymentsFilters } from '../components/PaymentsFilters';
import type { PaymentsFilterValues } from '../components/PaymentsFilters';
import { PaymentsRevenueCard } from '../components/PaymentsRevenueCard';
import { PaymentsSummary } from '../components/PaymentsSummary';
import { getPaymentsReport } from '../services/payments.api';
import type { Payment } from '../types/payment.types';
import { buildPaymentsCsv, buildPaymentsFileName, downloadCsv } from '../utils/paymentsExport';
import { formatAmount, formatPaymentTime } from '../utils/paymentsFormat';
import { methodLabelKey, methodTone, statusLabelKey, statusTone } from '../utils/paymentsLabels';
import './PaymentsPage.css';

const PAGE_SIZE = 8;
const QUERY_KEY = ['payments', 'report'] as const;

const emptyPaymentFilters: PaymentsFilterValues = {
  query: '',
  room: 'all',
  method: 'all',
  status: 'all',
  range: 'all',
  from: '',
  to: '',
};

function filterPayments(payments: Payment[], values: PaymentsFilterValues): Payment[] {
  const query = values.query.trim().toLowerCase();

  return payments.filter((payment) => {
    if (values.room !== 'all' && payment.roomNo !== values.room) return false;
    if (values.method !== 'all' && payment.method !== values.method) return false;
    if (values.status !== 'all' && payment.status !== values.status) return false;

    const paidOn = payment.paidAt ? toDayKey(payment.paidAt) : '';
    if (values.from && (!paidOn || paidOn < values.from)) return false;
    if (values.to && (!paidOn || paidOn > values.to)) return false;

    if (query) {
      const haystack = [payment.guestName, payment.invoiceNo, payment.roomNo, payment.method, payment.recordedBy]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function PaymentsPage() {
  const outlet = useOutletContext<{ language?: Language } | undefined>();
  const language: Language = outlet?.language ?? 'ar';
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const [filters, setFilters] = useState<PaymentsFilterValues>(emptyPaymentFilters);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getPaymentsReport(),
  });

  const payments = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => filterPayments(payments, filters), [payments, filters]);
  const roomOptions = useMemo(
    () => Array.from(new Set(payments.map((payment) => payment.roomNo).filter((room): room is string => Boolean(room)))).sort(),
    [payments],
  );
  const { page, setPage, totalPages, items } = usePagination(filtered, PAGE_SIZE);

  const receipt = receiptId ? payments.find((payment) => payment.id === receiptId) ?? null : null;
  const OpenIcon = language === 'ar' ? ChevronLeft : ChevronRight;

  const handleFiltersChange = (values: PaymentsFilterValues) => {
    setFilters(values);
    setPage(1);
  };

  const handleReset = () => {
    setFilters(emptyPaymentFilters);
    setPage(1);
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.showToast(t('paymentsPage.noExport'), 'error');
      return;
    }
    downloadCsv(buildPaymentsFileName(), buildPaymentsCsv(filtered));
    toast.showToast(t('paymentsPage.exported').replace('{count}', formatNumber(filtered.length, language)), 'success');
  };

  const handleAddPayment = () => {
    setAddFormKey((current) => current + 1);
    setAddOpen(true);
  };

  const label = (key: string | null, fallback: string) => (key ? t(key) : fallback);
  const roomLabel = (room?: string) => (room ? (/^\d+$/.test(room) ? formatNumber(Number(room), language) : room) : '—');

  const columns = [
    { key: 'reference', label: t('paymentsPage.table.reference'), render: (row: unknown) => {
      const payment = row as Payment;
      return <span className="payments-page__reference">{payment.invoiceNo ?? payment.id}</span>;
    } },
    { key: 'room', label: t('paymentsPage.table.room'), render: (row: unknown) => {
      const room = (row as Payment).roomNo;
      return room ? <span className="table-card__chip">{roomLabel(room)}</span> : '—';
    } },
    { key: 'guest', label: t('paymentsPage.table.guest'), render: (row: unknown) => (row as Payment).guestName ?? '—' },
    { key: 'amount', label: t('paymentsPage.table.amount'), render: (row: unknown) => (
      <span className="payments-page__amount">{formatAmount((row as Payment).amount, language)}</span>
    ) },
    { key: 'method', label: t('paymentsPage.table.method'), render: (row: unknown) => {
      const payment = row as Payment;
      return <Badge tone={methodTone(payment.method)}>{label(methodLabelKey(payment.method), payment.method)}</Badge>;
    } },
    { key: 'time', label: t('paymentsPage.table.time'), render: (row: unknown) => formatPaymentTime((row as Payment).paidAt, language) },
    { key: 'status', label: t('paymentsPage.table.status'), render: (row: unknown) => {
      const payment = row as Payment;
      return <Badge tone={statusTone(payment.status)}>{label(statusLabelKey(payment.status), payment.status)}</Badge>;
    } },
    { key: 'actions', label: t('paymentsPage.table.actions'), render: (row: unknown) => {
      const payment = row as Payment;
      return (
        <button
          type="button"
          className="table-card__open"
          aria-label={t('paymentsPage.table.open').replace('{ref}', payment.invoiceNo ?? payment.id)}
          onClick={() => setReceiptId(payment.id)}
        >
          <OpenIcon aria-hidden="true" />
        </button>
      );
    } },
  ];

  const summary = t('paymentsPage.table.summary')
    .replace('{rows}', formatNumber(items.length, language))
    .replace('{total}', formatNumber(filtered.length, language));

  return (
    <div className="feature-page payments-page">
      <PageHero eyebrow={t('paymentsPage.eyebrow')} title={t('paymentsPage.title')} description={t('paymentsPage.description')}>
        <Button variant="glass" onClick={handleExport}>
          <FileText aria-hidden="true" />
          {t('paymentsPage.export')}
        </Button>
        <Button variant="gold" onClick={handleAddPayment}>
          <Plus aria-hidden="true" />
          {t('paymentsPage.add')}
        </Button>
      </PageHero>

      {isPending ? (
        <LoadingState label={t('paymentsPage.loading')} />
      ) : isError ? (
        <ErrorState
          title={t('paymentsPage.loadError')}
          message={getErrorMessage(error, language)}
          action={<Button variant="secondary" onClick={() => void refetch()}>{t('paymentsPage.retry')}</Button>}
        />
      ) : (
        <>
          <PaymentsSummary payments={filtered} language={language} />

          <PaymentsRevenueCard payments={filtered} language={language} />

          <Card className="filters-card">
            <PaymentsFilters
              language={language}
              values={filters}
              roomOptions={roomOptions}
              onChange={handleFiltersChange}
              onReset={handleReset}
            />
          </Card>

          <TableCard
            title={t('paymentsPage.table.title')}
            subtitle={t('paymentsPage.table.subtitle')}
            badge={t('paymentsPage.table.count').replace('{count}', formatNumber(filtered.length, language))}
            footer={filtered.length > 0 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageLabel={summary}
                previousLabel={t('pagination.previous')}
                nextLabel={t('pagination.next')}
                navigationLabel={t('pagination.label')}
              />
            ) : undefined}
          >
            {filtered.length === 0 ? (
              <EmptyState title={t('paymentsPage.table.empty')} description={t('paymentsPage.table.emptyDesc')} />
            ) : (
              <Table columns={columns} rows={items} emptyMessage={t('paymentsPage.table.empty')} />
            )}
          </TableCard>
        </>
      )}

      <PaymentDetailsDrawer
        key={receipt?.id ?? 'closed'}
        payment={receipt}
        language={language}
        onClose={() => setReceiptId(null)}
      />

      <AddPaymentDrawer key={addFormKey} open={addOpen} language={language} onClose={() => setAddOpen(false)} />
    </div>
  );
}

