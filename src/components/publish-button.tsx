'use client';
import { useId, useState } from 'react';

/**
 * Publish, greyed out until publishing exists. It uses aria-disabled rather than disabled so it can still be
 * reached with the keyboard; hovering or focusing it shows why, and Escape closes the hint.
 */
export function PublishButton({ label, hint, small }: { label: string; hint: string; small?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="publish-group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        className={`button button-outline${small ? ' button-small' : ''}`}
        aria-disabled="true"
        aria-describedby={id}
        onClick={(event) => event.preventDefault()}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {label}
      </button>
      <span id={id} role="tooltip" className="infotip-text" data-open={open}>{hint}</span>
    </span>
  );
}
