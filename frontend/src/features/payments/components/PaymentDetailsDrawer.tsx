import { useState } from 'react';
import { Eye, EyeOff, Printer } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import type { Payment } from '../types/payment.types';
import { printReceipt } from '../utils/paymentsExport';
import { formatAmount, formatPaymentDate, formatPaymentTime } from '../utils/paymentsFormat';
import { methodLabelKey, statusLabelKey, statusTone } from '../utils/paymentsLabels';
import { ReceiptView } from './ReceiptView';
import './PaymentDetailsDrawer.css';

const EMPTY_VALUE = '—';

interface PaymentDetailsDrawerProps {
  payment: Payment | null;
  language: Language;
  onClose: () => void;
}

/**
 * Payment details in the shared Drawer with clean actions,
 * official hotel voucher preview, and direct print functionality.
 */
export function PaymentDetailsDrawer({ payment, language, onClose }: PaymentDetailsDrawerProps) {
  const t = (key: string) => getTranslation(language, key);
  const [showPreview, setShowPreview] = useState(false);

  const reference = payment ? payment.invoiceNo ?? `INV-${payment.id}` : '';
  const statusKey = payment ? statusLabelKey(payment.status) : null;
  const methodKey = payment ? methodLabelKey(payment.method) : null;

  const handlePrint = () => {
    printReceipt();
  };

  const handleTogglePreview = () => {
    setShowPreview((prev) => !prev);
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
          <Button variant="secondary" onClick={onClose}>
            {t('paymentsPage.details.close')}
          </Button>
          <Button onClick={handlePrint}>
            <Printer aria-hidden="true" />
            {t('paymentsPage.details.printReceipt')}
          </Button>
        </div>
      ) : undefined}
    >
      {payment && (
        <div className="drawer-details">
          {/* Amount and Status Hero */}
          <section className="drawer-details__amount">
            <span>{t('paymentsPage.details.amount')}</span>
            <strong>{formatAmount(payment.amount, language)}</strong>
            <Badge tone={statusTone(payment.status)}>
              {statusKey ? t(statusKey) : payment.status}
            </Badge>
          </section>

          {/* Details Grid */}
          <div className="drawer-details__grid">
            <div className="drawer-details__info">
              <span>{t('paymentsPage.details.room')}</span>
              <strong>
                {payment.roomNo
                  ? (/^\d+$/.test(payment.roomNo) ? formatNumber(Number(payment.roomNo), language) : payment.roomNo)
                  : EMPTY_VALUE}
              </strong>
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
              <strong>
                {formatPaymentTime(payment.paidAt, language)} · {formatPaymentDate(payment.paidAt, language)}
              </strong>
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

          {/* Original Saved Note (Display-only) */}
          {payment.notes && (
            <section className="payment-details__saved-note-section">
              <h3 className="drawer-details__heading">{t('paymentsPage.details.notes')}</h3>
              <p className="payment-details__saved-note">{payment.notes}</p>
            </section>
          )}

          {/* Clean Action Button */}
          <div className="payment-details__actions-clean">
            <button
              type="button"
              className="payment-details__action-btn"
              onClick={handleTogglePreview}
              aria-pressed={showPreview}
            >
              {showPreview ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              {showPreview ? t('paymentsPage.details.hideReceipt') : t('paymentsPage.details.previewReceipt')}
            </button>
          </div>

          {/* Official Voucher Component (Always mounted for print, conditionally displayed on screen) */}
          <div
            className={
              showPreview
                ? 'payment-details__receipt-wrapper'
                : 'payment-details__receipt-wrapper payment-details__receipt-wrapper--print-only'
            }
          >
            <ReceiptView payment={payment} language={language} />
          </div>
        </div>
      )}
    </Drawer>
  );
}
