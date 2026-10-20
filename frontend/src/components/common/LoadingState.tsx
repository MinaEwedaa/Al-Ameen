import { Spinner } from '../ui/Spinner';
import './LoadingState.css';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <div className="ui-loading-state"><Spinner label={label} /><span>{label}</span></div>;
}
