import type { Locale } from './i18n';
import { fill } from './account-deletion';

/**
 * The words for a field that needs filling or checking (brief docs/briefs/2026-10-18-form-warnings.md, rule in docs/guides/ACCESSIBILITY.md).
 * They replace the browser's own pop-up, which speaks the browser's language and shows one field at a time.
 */
const en = {
  missing: 'Fill in “{field}”.',
  tick: 'Tick this box to continue.',
  tooShort: 'Use at least {min} characters.',
  invalid: 'Check this field: the format is not right.',
  format: {
    email: 'Enter an email address like name@example.org.',
    website: 'Enter the website address starting with https://.',
    country: 'Enter two letters, for example DE.',
  } as Record<string, string>,
};
export type WarningCopy = typeof en;
const ro: WarningCopy = {
  missing: 'Completează „{field}”.',
  tick: 'Bifează această casetă pentru a continua.',
  tooShort: 'Folosește cel puțin {min} caractere.',
  invalid: 'Verifică acest câmp: formatul nu este corect.',
  format: {
    email: 'Introdu o adresă de email de forma nume@exemplu.ro.',
    website: 'Introdu adresa site-ului, începând cu https://.',
    country: 'Introdu două litere, de exemplu RO.',
  },
};
const de: WarningCopy = {
  missing: 'Füllen Sie „{field}“ aus.',
  tick: 'Setzen Sie hier ein Häkchen, um fortzufahren.',
  tooShort: 'Verwenden Sie mindestens {min} Zeichen.',
  invalid: 'Prüfen Sie dieses Feld: Das Format stimmt nicht.',
  format: {
    email: 'Geben Sie eine E-Mail-Adresse wie name@beispiel.de ein.',
    website: 'Geben Sie die Internetadresse ein, beginnend mit https://.',
    country: 'Geben Sie zwei Buchstaben ein, zum Beispiel DE.',
  },
};
export const getWarningCopy = (locale: Locale): WarningCopy => ({ en, ro, de })[locale];

/** The parts of a form control the browser's own checks look at. */
export type CheckedField = {
  name: string;
  type: string;
  minLength?: number;
  validity: Pick<ValidityState, 'valueMissing' | 'tooShort' | 'typeMismatch' | 'patternMismatch' | 'badInput'>;
};

/** What to tell the person about one control that failed the browser's checks (it names the problem and what to do). */
export function warningFor(field: CheckedField, label: string, copy: WarningCopy): string {
  const { validity } = field;
  if (validity.valueMissing) return field.type === 'checkbox' ? copy.tick : fill(copy.missing, { field: label });
  if (validity.tooShort) return fill(copy.tooShort, { min: String(field.minLength ?? 0) });
  if (validity.typeMismatch || validity.patternMismatch || validity.badInput) return copy.format[field.name] ?? copy.invalid;
  return copy.invalid;
}
