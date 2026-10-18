import type { Locale } from '@/lib/i18n';
import { getStepsCopy, stepStates } from '@/lib/onboarding-steps';
import type { OrganizationApplication } from '@/lib/verification';

export function OnboardingSteps({ locale, application }: { locale: Locale; application: Pick<OrganizationApplication, 'status'> | null }) {
  const t = getStepsCopy(locale);
  const states = stepStates(application);
  return <ol className="onboarding-steps" aria-label={t.label}>
    {t.steps.map((step, i) => <li key={step} aria-current={states[i] === 'current' ? 'step' : undefined} data-state={states[i]}>
      <span className="onboarding-mark" aria-hidden="true">{states[i] === 'done' ? '✓' : i + 1}</span>
      <span>{step}{states[i] !== 'upcoming' && <span className="sr-only"> ({states[i] === 'done' ? t.done : t.current})</span>}</span>
    </li>)}
  </ol>;
}
