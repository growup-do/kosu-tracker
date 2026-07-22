import type { WorkType } from '../types';

export function WorkTag({ w }: { w: WorkType }) {
  return (
    <span className={'wtag ' + (w.kind === 'design' ? 'k-design' : 'k-coding')}>
      <span className="wdot" />
      {w.name}
    </span>
  );
}
