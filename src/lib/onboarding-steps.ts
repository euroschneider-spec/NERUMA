import type { Locale } from './i18n';
import type { OrganizationApplication } from './verification';

// The first visit of a new organisation: where the person is on the way to an approved account.
export type StepState = 'done' | 'current' | 'upcoming';

const copy = {
  en: { label: 'Your first steps', steps: ['Email confirmed', 'Send your request', 'Wait for approval'], done: 'done', current: 'current step' },
  ro: { label: 'Primii tăi pași', steps: ['Email confirmat', 'Trimite cererea', 'Așteaptă aprobarea'], done: 'încheiat', current: 'pasul curent' },
  de: { label: 'Ihre ersten Schritte', steps: ['E-Mail bestätigt', 'Antrag senden', 'Auf Genehmigung warten'], done: 'erledigt', current: 'aktueller Schritt' },
};
export const getStepsCopy = (locale: Locale) => copy[locale];

// The email is always confirmed here. A request that was sent and is waiting moves the person to the last step;
// one that needs more information or was rejected is back at the second, where the form is.
export function stepStates(application: Pick<OrganizationApplication, 'status'> | null): StepState[] {
  const waiting = application !== null && !['needs_information', 'rejected'].includes(application.status);
  return waiting ? ['done', 'done', 'current'] : ['done', 'current', 'upcoming'];
}
