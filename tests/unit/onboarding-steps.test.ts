import { describe, expect, it } from 'vitest';
import { getStepsCopy, stepStates } from '@/lib/onboarding-steps';

describe('stepStates', () => {
  it('asks a person who has not applied to send the request', () => {
    expect(stepStates(null)).toEqual(['done', 'current', 'upcoming']);
  });
  it('moves a person whose request is waiting to the last step', () => {
    expect(stepStates({ status: 'pending' })).toEqual(['done', 'done', 'current']);
  });
  it('sends a person who was asked for more information, or rejected, back to the form', () => {
    expect(stepStates({ status: 'needs_information' })).toEqual(['done', 'current', 'upcoming']);
    expect(stepStates({ status: 'rejected' })).toEqual(['done', 'current', 'upcoming']);
  });
  it('names three steps in every language', () => {
    for (const locale of ['en', 'ro', 'de'] as const) expect(getStepsCopy(locale).steps).toHaveLength(3);
  });
});
