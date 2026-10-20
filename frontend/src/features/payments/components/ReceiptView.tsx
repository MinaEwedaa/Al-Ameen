import { Badge } from '../../../components/ui/Badge';
import { appConfig } from '../../../app/config/app.config';
import { DEFAULT_CURRENCY, formatCurrency } from '../../../core/utils/currency';
import { formatDateTime } from '../../../core/utils/date';
import type { Payment } from '../types/payment.types';

interface ReceiptViewProps {
  payment: Payment;
}

export function ReceiptView({ payment }: ReceiptViewProps) {
  return (
    <article className="receipt receipt-print" id="payment-receipt">
      <header className="receipt__header">
        <strong>{appConfig.name}</strong>
        <span>إيصال دفع / Payment Receipt</span>
      </header>

      <dl className="receipt__rows">
        <div><dt>رقم الإيصال</dt><dd>{payment.invoiceNo ?? payment.id}</dd></div>
        <div><dt>الضيف</dt><dd>{payment.guestName ?? '—'}</dd></div>
        <div><dt>الغرفة</dt><dd>{payment.roomNo ?? '—'}</dd></div>
        <div><dt>التاريخ</dt><dd>{formatDateTime(payment.paidAt)}</dd></div>
        <div><dt>الطريقة</dt><dd>{payment.method}</dd></div>
        <div>
          <dt>الحالة</dt>
          <dd>
            <Badge tone={payment.status === 'Completed' ? 'success' : 'warning'}>{payment.status}</Badge>
          </dd>
        </div>
        <div><dt>الموظف المستلم</dt><dd>{payment.recordedBy ?? '—'}</dd></div>
      </dl>

      <p className="receipt__total">
        <span>المبلغ الإجمالي</span>
        <strong>{formatCurrency(payment.amount, DEFAULT_CURRENCY)}</strong>
      </p>

      <footer className="receipt__footer">شكراً لإقامتكم معنا — {appConfig.name}</footer>
    </article>
  );
}
