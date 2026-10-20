import { useEffect, useRef, useState } from 'react';
import { FileText, Receipt, Upload } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/common/toast.context';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import { ReceiptView } from './ReceiptView';
import type { Payment } from '../types/payment.types';
import { buildPaymentsCsv, downloadCsv, printReceipt } from '../utils/paymentsExport';
import { formatAmount, formatPaymentDate, formatPaymentTime } from '../utils/paymentsFormat';
import { methodLabelKey, statusLabelKey, statusTone } from '../utils/paymentsLabels';
import './PaymentDetailsDrawer.css';

const EMPTY_VALUE = '—';

interface PaymentDetailsDrawerProps {
  payment: Payment | null;
  language: Language;
  onClose: () => void;
}

/**
 * Payment details in the shared Drawer, same layout as the other details drawers.
 * The receipt / CSV / print actions work exactly as before.
 * The parent gives this component a `key` per payment, so the note and receipt reset when another payment opens.
 */
export function PaymentDetailsDrawer({ payment, language, onClose }: PaymentDetailsDrawerProps) {
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const [note, setNote] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const pendingPrint = useRef(false);

  useEffect(() => {
    if (showReceipt && pendingPrint.current) {
      pendingPrint.current = false;
      printReceipt();
    }
  }, [showReceipt]);

  const reference = payment ? payment.invoiceNo ?? payment.id : '';
  const statusKey = payment ? statusLabelKey(payment.status) : null;
  const methodKey = payment ? methodLabelKey(payment.method) : null;

  const handleCashierLog = () => setShowReceipt((visible) => !visible);

  const handleExport = () => {
    if (!payment) return;
    downloadCsv(`payment-${payment.id}.csv`, buildPaymentsCsv([payment]));
    toast.showToast(t('paymentsPage.details.exported'), 'success');
  };

  const handleAddReceipt = () => {
    setShowReceipt(true);
    toast.showToast(t('paymentsPage.details.receiptShown'), 'info');
  };

  const handleSendReceipt = () => {
    if (showReceipt) {
      printReceipt();
      return;
    }
    pendingPrint.current = true;
    setShowReceipt(true);
  };

  return (
    <Drawer
      open={payment !== null}
      title={reference}
      eyebrow={t('paymentsPage.details.eyebrow')}
      closeLabel={t('drawerClose')}
      onClose={onClose}
      className="payment-details-drawer"
      footer={payment ? (
        <div className="drawer-details__footer">
          <Button variant="secondary" onClick={onClose}>{t('paymentsPage.details.close')}</Button>
          <Button onClick={handleSendReceipt}>{t('paymentsPage.details.send')}</Button>
        </div>
      ) : undefined}
    >
      {payment && (
        <div className="drawer-details">
          <section className="drawer-details__amount">
            <span>{t('paymentsPage.details.amount')}</span>
            <strong>{formatAmount(payment.amount, language)}</strong>
            <Badge tone={statusTone(payment.status)}>{statusKey ? t(statusKey) : payment.status}</Badge>
          </section>

          <div className="drawer-details__grid">
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.room')}</span>
              <strong>{payment.roomNo ? (/^\d+$/.test(payment.roomNo) ? formatNumber(Number(payment.roomNo), language) : payment.roomNo) : EMPTY_VALUE}</strong>
            </div>
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.guest')}</span>
              <strong>{payment.guestName ?? EMPTY_VALUE}</strong>
            </div>
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.method')}</span>
              <strong>{methodKey ? t(methodKey) : payment.method}</strong>
            </div>
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.time')}</span>
              <strong>{formatPaymentTime(payment.paidAt, language)} · {formatPaymentDate(payment.paidAt, language)}</strong>
            </div>
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.reference')}</span>
              <strong className="payment-details__mono">{reference}</strong>
            </div>
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.staff')}</span>
              <strong>{payment.recordedBy ?? EMPTY_VALUE}</strong>
            </div>
          </div>

          <section>
            <h3 className="drawer-details__heading">{t('paymentsPage.details.notes')}</h3>
            {payment.notes && <p className="drawer-details__box payment-details__saved-note">{payment.notes}</p>}
            <textarea
              className="drawer-details__textarea"
              aria-label={t('paymentsPage.details.notes')}
              placeholder={t('paymentsPage.details.notesPh')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </section>

          <div className="drawer-details__actions drawer-details__actions--three">
            <button type="button" className="drawer-details__action" onClick={handleAddReceipt}>
              <FileText aria-hidden="true" />
              {t('paymentsPage.details.receipt')}
            </button>
            <button type="button" className="drawer-details__action" onClick={handleExport}>
              <Upload aria-hidden="true" />
              {t('paymentsPage.details.export')}
            </button>
            <button type="button" className="drawer-details__action" onClick={handleCashierLog} aria-pressed={showReceipt}>
              <Receipt aria-hidden="true" />
              {t('paymentsPage.details.cashierLog')}
            </button>
          </div>

          {showReceipt && (
            <div className="payment-details__receipt">
              <ReceiptView payment={payment} />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
