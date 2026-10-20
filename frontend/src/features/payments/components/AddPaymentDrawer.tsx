import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { useToast } from '../../../components/common/toast.context';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Select } from '../../../components/ui/Select';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getTranslation, type Language } from '../../../core/i18n';
import { createPayment, getReservationBalance } from '../services/payments.api';
import type { ApiPaymentMethod } from '../types/payment.types';
import { formatAmount, formatPaymentTime } from '../utils/paymentsFormat';
import './AddPaymentDrawer.css';

const FORM_ID = 'add-payment-form';

const METHODS: Array<{ value: ApiPaymentMethod; labelKey: string }> = [
  { value: 'cash', labelKey: 'paymentsPage.method.cash' },
  { value: 'instapay', labelKey: 'paymentsPage.method.instapay' },
  { value: 'vodafone_cash', labelKey: 'paymentsPage.method.vodafone' },
];

type Field = 'reservation' | 'amount' | 'method';

/** Accept Arabic-Indic digits (٠-٩) and the Arabic decimal mark as well as plain digits */
function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٫/g, '.');
}
type Balance =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'found'; remaining: number }
  | { state: 'notFound' };

interface AddPaymentDrawerProps {
  open: boolean;
  language: Language;
  onClose: () => void;
}

/** "Add payment" form. The parent remounts it (via `key`) each time it opens, so it always starts empty. */
export function AddPaymentDrawer({ open, language, onClose }: AddPaymentDrawerProps) {
  const t = (key: string) => getTranslation(language, key);
  const toast = useToast();
  const queryClient = useQueryClient();
  const baseId = useId();
  const fieldId = (field: string) => `${baseId}-${field}`;

  const [reservation, setReservation] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ApiPaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [balance, setBalance] = useState<Balance>({ state: 'idle' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [openedAt] = useState(() => new Date().toISOString());

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['shift-handover'] });
      void queryClient.invalidateQueries({ queryKey: ['shift-report'] });
    },
  });
  const saving = mutation.isPending;

  const reservationId = Number(reservation);
  const validReservation = /^\d+$/.test(reservation.trim()) && reservationId > 0;

  async function checkReservation() {
    if (!validReservation) {
      setBalance({ state: 'idle' });
      return;
    }
    setBalance({ state: 'checking' });
    try {
      const result = await getReservationBalance(reservationId);
      setBalance({ state: 'found', remaining: result.remainingAmount });
    } catch {
      setBalance({ state: 'notFound' });
    }
  }

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    const value = Number(amount);
    if (!validReservation) next.reservation = t('paymentsPage.addForm.errors.reservation');
    else if (balance.state === 'notFound') next.reservation = t('paymentsPage.addForm.notFound');
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) next.amount = t('paymentsPage.addForm.errors.amount');
    else if (balance.state === 'found' && value > balance.remaining) {
      next.amount = t('paymentsPage.addForm.errors.amountTooHigh').replace('{amount}', formatAmount(balance.remaining, language));
    }
    if (!method) next.method = t('paymentsPage.addForm.errors.method');
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    const firstInvalid = (['reservation', 'amount', 'method'] as Field[]).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        reservation_id: reservationId,
        amount: Number(amount),
        payment_method: method as ApiPaymentMethod,
        notes: notes.trim() || undefined,
      });
      toast.showToast(
        t('paymentsPage.addForm.success').replace('{amount}', formatAmount(result.remaining_amount, language)),
        'success',
      );
      onClose();
    } catch (error) {
      toast.showToast(getErrorMessage(error, language), 'error');
    }
  }

  const clearError = (field: Field) => setErrors((current) => ({ ...current, [field]: undefined }));

  const reservationHint =
    balance.state === 'checking' ? t('paymentsPage.addForm.checking')
      : balance.state === 'found' ? t('paymentsPage.addForm.remaining').replace('{amount}', formatAmount(balance.remaining, language))
        : undefined;

  return (
    <Drawer
      open={open}
      title={t('paymentsPage.addForm.title')}
      eyebrow={t('paymentsPage.addForm.eyebrow')}
      closeLabel={t('paymentsPage.addForm.close')}
      onClose={onClose}
      className="add-payment-drawer"
      footer={(
        <div className="payment-form__footer">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('paymentsPage.addForm.cancel')}</Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>{t('paymentsPage.addForm.submit')}</Button>
        </div>
      )}
    >
      <form id={FORM_ID} className="payment-form" onSubmit={(event) => { void handleSubmit(event); }} noValidate>
        <div className="payment-form__row">
          <label className="payment-form__field">
            <span>{t('paymentsPage.addForm.reservation')}</span>
            <input
              id={fieldId('reservation')}
              inputMode="numeric"
              dir="ltr"
              placeholder={t('paymentsPage.addForm.reservationPlaceholder')}
              value={reservation}
              disabled={saving}
              aria-invalid={errors.reservation ? true : undefined}
              className={errors.reservation ? 'payment-form__control--error' : undefined}
              onChange={(event) => { setReservation(toLatinDigits(event.target.value)); setBalance({ state: 'idle' }); clearError('reservation'); }}
              onBlur={() => { void checkReservation(); }}
            />
            {errors.reservation
              ? <small className="payment-form__error">{errors.reservation}</small>
              : balance.state === 'notFound'
                ? <small className="payment-form__error">{t('paymentsPage.addForm.notFound')}</small>
                : reservationHint && <small className="payment-form__hint-text">{reservationHint}</small>}
          </label>

          <label className="payment-form__field">
            <span>{t('paymentsPage.addForm.amount')}</span>
            <input
              id={fieldId('amount')}
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder={t('paymentsPage.addForm.amountPlaceholder')}
              value={amount}
              disabled={saving}
              aria-invalid={errors.amount ? true : undefined}
              className={errors.amount ? 'payment-form__control--error' : undefined}
              onChange={(event) => { setAmount(toLatinDigits(event.target.value)); clearError('amount'); }}
            />
            {errors.amount && <small className="payment-form__error">{errors.amount}</small>}
          </label>
        </div>

        <div className="payment-form__row">
          <Select
            id={fieldId('method')}
            label={t('paymentsPage.addForm.method')}
            value={method}
            placeholder={t('paymentsPage.addForm.methodPlaceholder')}
            options={METHODS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
            onChange={(next) => { setMethod(next as ApiPaymentMethod); clearError('method'); }}
            error={errors.method}
            disabled={saving}
          />
          <label className="payment-form__field">
            <span>{t('paymentsPage.addForm.time')}</span>
            <input
              value={t('paymentsPage.addForm.timeNow').replace('{time}', formatPaymentTime(openedAt, language))}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
            />
          </label>
        </div>

        <label className="payment-form__field">
          <span>{t('paymentsPage.addForm.notes')}</span>
          <textarea
            rows={4}
            placeholder={t('paymentsPage.addForm.notesPlaceholder')}
            value={notes}
            disabled={saving}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <p className="payment-form__info">
          <Wallet aria-hidden="true" />
          {t('paymentsPage.addForm.info')}
        </p>
      </form>
    </Drawer>
  );
}
