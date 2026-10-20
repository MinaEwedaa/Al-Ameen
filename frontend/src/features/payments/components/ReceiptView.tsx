import { getTranslation, type Language } from '../../../core/i18n';
import { formatNumber } from '../../../utils/format';
import type { Payment } from '../types/payment.types';
import { formatAmount, formatPaymentDate, formatPaymentTime } from '../utils/paymentsFormat';
import { methodLabelKey, statusLabelKey } from '../utils/paymentsLabels';
import './ReceiptView.css';

interface ReceiptViewProps {
  payment: Payment;
  language?: Language;
}

export function ReceiptView({ payment, language = 'ar' }: ReceiptViewProps) {
  const t = (key: string) => getTranslation(language, key);

  const reference = payment.invoiceNo ?? `INV-${payment.id}`;
  const methodKey = methodLabelKey(payment.method);
  const statusKey = statusLabelKey(payment.status);

  const roomDisplay = payment.roomNo
    ? /^\d+$/.test(payment.roomNo)
      ? `${t('paymentsPage.details.voucher.roomNo')} ${formatNumber(Number(payment.roomNo), language)}`
      : payment.roomNo
    : '—';

  return (
    <article className="receipt-voucher receipt-print" id="payment-receipt" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header with Hotel Branding */}
      <header className="receipt-voucher__header">
        <div className="receipt-voucher__brand">
          <img
            src="/al-amin-hotel-logo.png"
            alt={t('reportPage.logoAlt')}
            className="receipt-voucher__logo"
          />
          <div className="receipt-voucher__hotel-titles">
            <span className="receipt-voucher__hotel-name-ar">
              {t('paymentsPage.details.voucher.hotelNameAr')}
            </span>
            <span className="receipt-voucher__hotel-name-en">
              {t('paymentsPage.details.voucher.hotelNameEn')}
            </span>
          </div>
        </div>

        <div className="receipt-voucher__title-block">
          <h2 className="receipt-voucher__doc-title">
            {t('paymentsPage.details.voucher.title')}
          </h2>
          <span className="receipt-voucher__doc-sub">
            {t('paymentsPage.details.voucher.subtitle')}
          </span>
          <span className="receipt-voucher__serial-badge">
            {reference}
          </span>
        </div>
      </header>

      {/* Guest & Transaction Details Grid */}
      <section className="receipt-voucher__grid">
        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.guestName')}</span>
          <strong className="receipt-voucher__value">{payment.guestName ?? '—'}</strong>
        </div>

        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.roomNo')}</span>
          <strong className="receipt-voucher__value">{roomDisplay}</strong>
        </div>

        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.date')}</span>
          <strong className="receipt-voucher__value">
            {formatPaymentDate(payment.paidAt, language)} · {formatPaymentTime(payment.paidAt, language)}
          </strong>
        </div>

        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.paymentMethod')}</span>
          <strong className="receipt-voucher__value">
            {methodKey ? t(methodKey) : payment.method}
          </strong>
        </div>

        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.staff')}</span>
          <strong className="receipt-voucher__value">{payment.recordedBy ?? '—'}</strong>
        </div>

        <div className="receipt-voucher__item">
          <span className="receipt-voucher__label">{t('paymentsPage.details.voucher.status')}</span>
          <strong className="receipt-voucher__value">
            {statusKey ? t(statusKey) : payment.status}
          </strong>
        </div>
      </section>

      {/* Amount Box */}
      <section className="receipt-voucher__amount-box">
        <div className="receipt-voucher__amount-details">
          <span className="receipt-voucher__amount-label">
            {t('paymentsPage.details.voucher.amountPaid')}
          </span>
          <span className="receipt-voucher__amount-value">
            {formatAmount(payment.amount, language)}
          </span>
        </div>
        <span className="receipt-voucher__status-badge">
          {statusKey ? t(statusKey) : payment.status}
        </span>
      </section>

      {/* Optional Notes */}
      {payment.notes && (
        <section className="receipt-voucher__notes">
          <span className="receipt-voucher__notes-label">
            {t('paymentsPage.details.voucher.notes')}:
          </span>
          <span>{payment.notes}</span>
        </section>
      )}

      {/* Signatures & Stamp */}
      <footer className="receipt-voucher__signatures">
        <div className="receipt-voucher__signature-col">
          <span className="receipt-voucher__sig-label">
            {t('paymentsPage.details.voucher.cashierSignature')}
          </span>
          <div className="receipt-voucher__sig-line" />
        </div>

        <div className="receipt-voucher__signature-col">
          <span className="receipt-voucher__sig-label">
            {t('paymentsPage.details.voucher.hotelStamp')}
          </span>
          <div className="receipt-voucher__stamp-box">
            <span>STAMP / ختم</span>
          </div>
        </div>
      </footer>

      {/* Legal & Thank You Footer */}
      <div className="receipt-voucher__footer">
        <p className="receipt-voucher__thank-you">
          {t('paymentsPage.details.voucher.thankYou')}
        </p>
        <span className="receipt-voucher__legal">
          {t('paymentsPage.details.voucher.systemNotice')}
        </span>
      </div>
    </article>
  );
}
