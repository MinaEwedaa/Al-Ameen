import './Spinner.css';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ui-spinner" role="status" aria-label={label}>
      <span />
    </div>
  );
}
