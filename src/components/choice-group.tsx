'use client';
import { useId } from 'react';

export type Choice = { value: string; label: string };

type Props = {
  label: string;
  options: readonly Choice[];
  name?: string;
  disabled?: boolean;
  className?: string;
} & (
  | { value: string; onChange: (value: string) => void; defaultValue?: undefined }
  | { defaultValue?: string; value?: undefined; onChange?: undefined }
);

/**
 * A row of visible choices instead of a dropdown: every option is on screen, one tap picks it, and the
 * arrow keys move between them (they are native radio buttons). Controlled with `value` and `onChange`,
 * or uncontrolled with `defaultValue` inside a form that reads `name`.
 */
export function ChoiceGroup({ label, options, name, disabled, className, value, defaultValue, onChange }: Props) {
  const id = useId();
  const controlled = value !== undefined;
  return (
    <div className={`form-field choice-field ${className ?? ''}`.trim()} role="radiogroup" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="choice-label">{label}</span>
      <div className="choice-options">
        {options.map((option) => (
          <label key={option.value} className="seg-opt">
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              disabled={disabled}
              {...(controlled
                ? { checked: value === option.value, onChange: () => onChange(option.value) }
                : { defaultChecked: defaultValue === option.value })}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
