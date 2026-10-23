import { useId, useState } from 'react';
import { CheckCircle2, Clock, FileText, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ErrorState } from '../../../components/common/ErrorState';
import { LoadingState } from '../../../components/common/LoadingState';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { useLanguage } from '../../../core/i18n/useLanguage';
import { formatNumber } from '../../../utils/format';
import { COMMENT_MAX_LENGTH, REVIEW_STATUS_TONE, SHIFTS_I18N } from '../constants/shifts.constants';
import { useShiftHandover, useShiftReport } from '../hooks/useShifts';
import { validateReview } from '../schemas/assignment.schema';
import { apiErrorText, formatDateTime, formatDay, pluralText, reportMoneyRows } from '../utils/shiftDisplay';
import { ShiftInfoTile } from './ShiftInfoTile';
import './ShiftDrawers.css';

interface HandoverReviewDrawerProps {
  reportId: string | null;
  isSaving: boolean;
  /** Resolves true when the decision was saved */
  onDecide: (reportId: string, status: 'APPROVED' | 'NEEDS_REVIEW', comment: string) => Promise<boolean>;
  onClose: () => void;
}

// "مراجعة التسليم": GET /shift-reports/{id} + /handover, then PATCH /review with APPROVED or NEEDS_REVIEW.
export function HandoverReviewDrawer({ reportId, isSaving, onDecide, onClose }: HandoverReviewDrawerProps) {
  const { language, t: translate } = useLanguage();
  const t = (key: string) => translate(`${SHIFTS_I18N}.${key}`);
  const commentId = useId();
  const reportQuery = useShiftReport(reportId);
  const handoverQuery = useShiftHandover(reportId);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (!reportId) return null;

  const report = reportQuery.data;
  const decided = report?.review_status === 'APPROVED';
  const shiftName = report?.shift_type ? t(`names.${report.shift_type}`) : '';

  function decide(status: 'APPROVED' | 'NEEDS_REVIEW') {
    const error = validateReview({ comment }, status, COMMENT_MAX_LENGTH);
    setCommentError(error);
    if (error) {
      document.getElementById(commentId)?.focus();
      return;
    }
    if (status === 'APPROVED') {
      setConfirming(true);
      return;
    }
    void onDecide(reportId as string, status, comment.trim()).then((saved) => { if (saved) setComment(''); });
  }

  async function confirmApprove() {
    if (await onDecide(reportId as string, 'APPROVED', comment.trim())) {
      setConfirming(false);
      setComment('');
    }
  }

  let content;
  if (reportQuery.isPending) content = <LoadingState label={t('loadingReport')} />;
  else if (reportQuery.isError || !report) {
    content = (
      <ErrorState
        title={t('reportLoadError')}
        message={apiErrorText(reportQuery.error, t, language)}
        action={<Button variant="secondary" onClick={() => { void reportQuery.refetch(); }}>{t('retry')}</Button>}
      />
    );
  } else {
    const handover = handoverQuery.data;
    content = (
      <div className="shift-drawer__body">
        <section className="shift-drawer__summary">
          <span className="shift-drawer__summary-icon" aria-hidden="true"><Clock /></span>
          <div className="shift-drawer__summary-text">
            <strong>{shiftName || t('shiftLabel')}</strong>
            <span>{formatDay(report.business_date, language)}</span>
          </div>
          <Badge tone={REVIEW_STATUS_TONE[report.review_status]}>{t(`review.${report.review_status}`)}</Badge>
        </section>

        <div className="shift-drawer__grid">
          <ShiftInfoTile label={t('tiles.handedBy')}>{report.staff_name ?? '—'}</ShiftInfoTile>
          <ShiftInfoTile label={t('tiles.submittedAt')}>{report.submitted_at ? formatDateTime(report.submitted_at, language) : '—'}</ShiftInfoTile>
          <ShiftInfoTile label={t('tiles.rooms')}>{report.rooms_handled === undefined ? '—' : pluralText(t, 'units.rooms', report.rooms_handled, language)}</ShiftInfoTile>
          <ShiftInfoTile label={t('tiles.cleaning')}>{report.cleaning_tasks === undefined ? '—' : pluralText(t, 'units.tasks', report.cleaning_tasks, language)}</ShiftInfoTile>
          <ShiftInfoTile label={t('tiles.pending')}>{report.pending_items === undefined ? '—' : formatNumber(report.pending_items, language)}</ShiftInfoTile>
        </div>

        <section>
          <h3 className="shift-drawer__heading">{t('reportFinancials')}</h3>
          <div className="shift-drawer__grid">
            {reportMoneyRows(report, t, language).map((row) => <ShiftInfoTile key={row.label} label={row.label}>{row.value}</ShiftInfoTile>)}
          </div>
        </section>

        <section>
          <h3 className="shift-drawer__heading">{t('handoverNotes')}</h3>
          <p className="shift-drawer__box" dir="auto">
            {handoverQuery.isPending ? t('loadingReport') : handover?.notes || t('noNotes')}
          </p>
          {handover?.follow_ups && handover.follow_ups.length > 0 && (
            <ul className="shift-drawer__followups">
              {handover.follow_ups.map((item) => <li key={item} dir="auto">{item}</li>)}
            </ul>
          )}
        </section>

        {report.pdf_url && (
          <a className="shift-drawer__link" href={report.pdf_url} target="_blank" rel="noreferrer">
            <FileText aria-hidden="true" />
            {t('openPdf')}
          </a>
        )}

        {decided ? (
          <p className="shift-drawer__approved">
            <CheckCircle2 aria-hidden="true" />
            {report.reviewed_at ? t('approvedAt').replace('{time}', formatDateTime(report.reviewed_at, language)) : t('review.APPROVED')}
            {report.manager_comment ? ` — ${report.manager_comment}` : ''}
          </p>
        ) : (
          <label className="shift-drawer__field" htmlFor={commentId}>
            <span>{t('managerComment')}</span>
            <textarea
              id={commentId}
              rows={3}
              value={comment}
              maxLength={COMMENT_MAX_LENGTH + 20}
              placeholder={t('managerCommentPlaceholder')}
              disabled={isSaving}
              aria-invalid={commentError ? true : undefined}
              aria-describedby={commentError ? `${commentId}-error` : undefined}
              className={commentError ? 'shift-drawer__control--error' : undefined}
              onChange={(event) => { setComment(event.target.value); if (commentError) setCommentError(null); }}
            />
            {commentError && (
              <span id={`${commentId}-error`} className="shift-drawer__error">
                {t(`errors.${commentError}`).replace('{max}', formatNumber(COMMENT_MAX_LENGTH, language))}
              </span>
            )}
            {report.review_status === 'NEEDS_REVIEW' && report.manager_comment && (
              <span className="shift-drawer__muted">{t('previousComment').replace('{comment}', report.manager_comment)}</span>
            )}
          </label>
        )}
      </div>
    );
  }

  const canDecide = !decided && Boolean(report);
  const canMarkNeedsReview = canDecide && report?.review_status !== 'NEEDS_REVIEW';
  const footerClass = !canDecide ? ' shift-drawer__footer--single' : canMarkNeedsReview ? ' shift-drawer__footer--three' : '';

  return (
    <>
      <Drawer
        open
        eyebrow={t('reviewEyebrow')}
        title={shiftName ? t('reviewTitle').replace('{shift}', shiftName) : t('reviewEyebrow')}
        closeLabel={t('close')}
        // Escape while the confirm dialog is open only closes the dialog
        onClose={confirming ? () => setConfirming(false) : onClose}
        className="shift-drawer"
        footer={(
          // Only the decisions still possible are shown: no "needs review" on a report already marked so
          <div className={`shift-drawer__footer${footerClass}`}>
            <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
            {!decided && report && (
              <>
                {canMarkNeedsReview && (
                  <Button variant="secondary" onClick={() => decide('NEEDS_REVIEW')} disabled={isSaving}>
                    <RotateCcw aria-hidden="true" />
                    {t('needsReview')}
                  </Button>
                )}
                <Button onClick={() => decide('APPROVED')} disabled={isSaving}>
                  <CheckCircle2 aria-hidden="true" />
                  {t('approveHandover')}
                </Button>
              </>
            )}
          </div>
        )}
      >
        {content}
      </Drawer>

      {confirming && report && (
        <ConfirmDialog
          icon={<CheckCircle2 />}
          title={t('approveConfirmTitle')}
          description={t('approveConfirmText').replace('{shift}', shiftName).replace('{employee}', report.staff_name ?? '')}
          confirmLabel={t('approveHandover')}
          cancelLabel={t('cancel')}
          busy={isSaving}
          onConfirm={() => { void confirmApprove(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
