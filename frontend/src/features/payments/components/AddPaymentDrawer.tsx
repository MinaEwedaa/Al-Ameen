import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { useToast } from '../../../components/common/toast.context';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Select } from '../../../components/ui/Select';
import { getErrorMessage } from '../../../core/errors/getErrorMessage';
import { getTranslation, type Language } from '../../../core/i18n';
import { getRooms } from '../../rooms/services/rooms.api';
import { createPayment, getRoomBalance } from '../services/payments.api';
import type { ApiPaymentMethod } from '../types/payment.types';
import { formatAmount, formatPaymentTime } from '../utils/paymentsFormat';
import './AddPaymentDrawer.css';

const FORM_ID = 'add-payment-form';

const METHODS: Array<{ value: ApiPaymentMethod; labelKey: string }> = [
  { value: 'cash', labelKey: 'paymentsPage.method.cash' },
  { value: 'instapay', labelKey: 'paymentsPage.method.instapay' },
  { value: 'vodafone_cash', labelKey: 'paymentsPage.method.vodafone' },
];

type Field = 'room' | 'amount' | 'method';

/** Accept Arabic-Indic digits (٠-٩) and the Arabic decimal mark as well as plain digits */
function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/٫/g, '.');
}

type Balance =
  | { state: 'idle' }
  | { state: 'checking' }
  | {
      state: 'found';
      remaining: number;
      guestName?: string;
      totalAmount?: number;
      paidAmount?: number;
      roomId?: string;
      reservationId?: string;
    }
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

  const [room, setRoom] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ApiPaymentMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [balance, setBalance] = useState<Balance>({ state: 'idle' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [openedAt] = useState(() => new Date().toISOString());

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  // Sort: occupied and reserved rooms first, then by room number
  const sortedRooms = [...rooms].sort((a, b) => {
    const activeA = a.status === 'occupied' || a.status === 'reserved' ? 0 : 1;
    const activeB = b.status === 'occupied' || b.status === 'reserved' ? 0 : 1;
    if (activeA !== activeB) return activeA - activeB;
    return a.number.localeCompare(b.number, undefined, { numeric: true });
  });

  const roomOptions = sortedRooms.map((r) => {
    const guest = r.guestName ? ` · ${r.guestName}` : '';
    const statusLabel = t(`rooms.status.${r.status}`);
    return {
      value: r.number,
      label: `${r.number}${guest} (${statusLabel})`,
    };
  });

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

  async function checkRoomBalance(roomNumber: string) {
    if (!roomNumber) {
      setBalance({ state: 'idle' });
      return;
    }
    setBalance({ state: 'checking' });
    try {
      const result = await getRoomBalance(roomNumber);
      setBalance({
        state: 'found',
        remaining: result.remainingAmount,
        guestName: result.guestName,
        totalAmount: result.totalAmount,
        paidAmount: result.paidAmount,
        roomId: result.roomId,
        reservationId: result.reservationId,
      });
    } catch {
      setBalance({ state: 'notFound' });
    }
  }

  function handleRoomSelect(value: string) {
    setRoom(value);
    clearError('room');
    void checkRoomBalance(value);
  }

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    const value = Number(amount);
    if (!room) next.room = t('paymentsPage.addForm.errors.room');
    else if (balance.state === 'notFound') next.room = t('paymentsPage.addForm.notFound');
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
    const firstInvalid = (['room', 'amount', 'method'] as Field[]).find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    try {
      const targetRoomId = balance.state === 'found' && balance.roomId ? balance.roomId : room;
      const targetReservationId = balance.state === 'found' && balance.reservationId ? balance.reservationId : undefined;
      const result = await mutation.mutateAsync({
        room_id: targetRoomId,
        reservation_id: targetReservationId,
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

  const remainingHint =
    balance.state === 'checking'
      ? t('paymentsPage.addForm.checking')
      : balance.state === 'found'
        ? t('paymentsPage.addForm.remaining').replace('{amount}', formatAmount(balance.remaining, language))
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
          <div className="payment-form__field">
            <Select
              id={fieldId('room')}
              label={t('paymentsPage.addForm.room')}
              value={room}
              placeholder={t('paymentsPage.addForm.roomPlaceholder')}
              options={roomOptions}
              onChange={handleRoomSelect}
              error={errors.room || (balance.state === 'notFound' ? t('paymentsPage.addForm.notFound') : undefined)}
              disabled={saving}
            />
            {balance.state === 'checking' && (
              <small className="payment-form__hint-text">{t('paymentsPage.addForm.checking')}</small>
            )}
            {balance.state === 'found' && (
              <div className="payment-form__balance-card">
                {balance.guestName && (
                  <small className="payment-form__guest-name">
                    {t('paymentsPage.addForm.guest').replace('{name}', balance.guestName)}
                  </small>
                )}
                {remainingHint && <small className="payment-form__hint-text">{remainingHint}</small>}
              </div>
            )}
          </div>

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
