'use client';
import { useId, useState } from 'react';

/**
 * A small "?" that shows a hint on hover, on keyboard focus and on tap, and closes with Escape. The hint
 * stays in the page for assistive technology (use `id` in `aria-describedby`), so it is never only visual.
 */
export function InfoTip({ id, text, label }: { id?: string; text: string; label: string }) {
  const generated = useId();
  const tipId = id ?? generated;
  const [open, setOpen] = useState(false);
  return (
    <span
      className="infotip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        className="infotip-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      <span id={tipId} role="tooltip" className="infotip-text" data-open={open}>{text}</span>
    </span>
  );
}
