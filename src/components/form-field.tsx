'use client';
import { cloneElement, useEffect, useId, useState, startTransition } from 'react';
import type { ChangeEvent, FormEvent, InputHTMLAttributes, ReactElement } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { getWarningCopy, warningFor } from '@/lib/form-warnings';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const isControl = (element: unknown): element is Control =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;

/**
 * Warnings for a form (docs/guides/ACCESSIBILITY.md, "Forms"). On Send every control is checked with the browser's own rules and
 * the screen jumps to the first one that needs attention; each such field says in words what to do. A warning goes away as soon as
 * its field is right (never before Send, and nothing is checked while typing), and none is left showing after Back or Forward.
 * The form is submitted from here, so what was typed stays when the server refuses. `reveal` makes a control that is folded away
 * visible (the guide editor opens its step); the focus then waits a frame for it to show.
 */
export function useFormWarnings(locale: Locale, send: (data: FormData) => void, reveal?: (control: Control) => void) {
  const copy = getWarningCopy(locale);
  const prefix = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    const clear = (event: PageTransitionEvent) => { if (event.persisted) setErrors({}); };
    window.addEventListener('pageshow', clear);
    return () => window.removeEventListener('pageshow', clear);
  }, []);
  const form = {
    noValidate: true,
    onSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const element = event.currentTarget;
      const found: Record<string, string> = {};
      let first: Control | null = null;
      for (const control of Array.from(element.elements)) {
        if (!isControl(control) || !control.name || !control.willValidate || control.validity.valid || found[control.name]) continue;
        found[control.name] = warningFor(control, control.labels?.[0]?.textContent?.trim() || control.name, copy);
        first ??= control;
      }
      setErrors(found);
      if (first && reveal) {
        const target = first;
        reveal(target);
        requestAnimationFrame(() => target.focus());
      }
      else if (first) first.focus();
      else startTransition(() => send(new FormData(element)));
    },
    onChange(event: ChangeEvent<HTMLFormElement>) {
      const control = event.target as unknown;
      if (!isControl(control) || !errors[control.name] || !control.validity.valid) return;
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== control.name)));
    },
  };
  return { form, errors, idOf: (name: string) => `${prefix}-${name}` };
}
export type FormWarnings = ReturnType<typeof useFormWarnings>;

/**
 * A labelled control with its hint and its warning, linked to it for screen readers; the warning also marks the control itself.
 * `id` is for a control that other code focuses by a fixed id.
 */
export function Field({ w, name, label, hint, className = '', id: fixedId, children }: {
  w: FormWarnings; name: string; label: string; hint?: string; className?: string; id?: string; children: ReactElement<Record<string, unknown>>;
}) {
  const id = fixedId ?? w.idOf(name);
  const warning = w.errors[name];
  const described = [hint && `${id}-hint`, warning && `${id}-warning`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`form-field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, 'aria-invalid': warning ? true : undefined, 'aria-describedby': described })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {warning && <p id={`${id}-warning`} className="field-warning">{warning}</p>}
    </div>
  );
}

/** A box to tick, with its sentence and its warning. */
export function CheckField({ w, name, label, className = '' }: { w: FormWarnings; name: string; label: string; className?: string }) {
  const id = w.idOf(name);
  const warning = w.errors[name];
  return (
    <div className={className || undefined}>
      <label className="checkbox-label commitment" htmlFor={id}>
        <input id={id} type="checkbox" name={name} required aria-invalid={warning ? true : undefined} aria-describedby={warning ? `${id}-warning` : undefined} />
        {label}
      </label>
      {warning && <p id={`${id}-warning`} className="field-warning">{warning}</p>}
    </div>
  );
}

/**
 * A password box with a button that shows what was typed. The button keeps one name and says whether it is pressed, so a screen
 * reader hears "Show password, pressed" rather than a name that changes. Everything else goes to the input, so a `Field` can wrap it.
 */
export function PasswordInput({ locale, ...input }: { locale: Locale } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const copy = getWarningCopy(locale);
  const [shown, setShown] = useState(false);
  return (
    <div className="password-box">
      <input {...input} type={shown ? 'text' : 'password'} />
      <button type="button" className="icon-button" aria-label={copy.showPassword} aria-pressed={shown} onClick={() => setShown((value) => !value)}>
        {shown ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
