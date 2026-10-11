import { describe, it, expect } from 'vitest';
import { newOwnField, newPlace, parsePlaceDraft, parseReportMessage, visibleZone } from '@/lib/workspace';

const org = crypto.randomUUID();
const filled = () => {
  const draft = newPlace();
  draft.name = 'Willow Museum';
  draft.city = 'Cluj';
  draft.zones[0].title = 'Entrance';
  draft.zones[0].description = 'Step-free door on the left.';
  return draft;
};
const photoFor = (draft: ReturnType<typeof filled>, overrides = {}) => {
  const id = crypto.randomUUID();
  return { id, storageKey: `${org}/${draft.id}/${draft.zones[0].id}/${id}.webp`, alt: 'Door', rights: 'Own work', photographedOn: '2026-01-02', ...overrides };
};

describe('parsePlaceDraft', () => {
  it('accepts a minimal valid draft', () => {
    expect(parsePlaceDraft(filled(), org)?.name).toBe('Willow Museum');
  });
  it('rejects non-objects, missing names and bad revisions', () => {
    expect(parsePlaceDraft(null, org)).toBeNull();
    expect(parsePlaceDraft('x', org)).toBeNull();
    expect(parsePlaceDraft({ ...filled(), name: '  ' }, org)).toBeNull();
    expect(parsePlaceDraft({ ...filled(), revision: -1 }, org)).toBeNull();
    expect(parsePlaceDraft({ ...filled(), revision: 1.5 }, org)).toBeNull();
  });
  it('limits zones to 1–8 and rejects duplicate ids', () => {
    const draft = filled();
    expect(parsePlaceDraft({ ...draft, zones: [] }, org)).toBeNull();
    expect(parsePlaceDraft({ ...draft, zones: Array(9).fill(draft.zones[0]) }, org)).toBeNull();
    expect(parsePlaceDraft({ ...draft, zones: [draft.zones[0], draft.zones[0]] }, org)).toBeNull();
  });
  it('validates the country code and sensory levels', () => {
    expect(parsePlaceDraft({ ...filled(), countryCode: 'ro' }, org)).toBeNull();
    expect(parsePlaceDraft({ ...filled(), countryCode: 'RO' }, org)?.countryCode).toBe('RO');
    const draft = filled();
    draft.zones[0].sensory = { ...draft.zones[0].sensory, sound: 'loud' as never };
    expect(parsePlaceDraft(draft, org)).toBeNull();
  });
  it('trims text fields', () => {
    expect(parsePlaceDraft({ ...filled(), city: '  Cluj ' }, org)?.city).toBe('Cluj');
  });

  describe('photos', () => {
    it('accepts a photo whose storage key matches org, place, zone and photo ids', () => {
      const draft = filled();
      draft.zones[0].photo = photoFor(draft);
      expect(parsePlaceDraft(draft, org)?.zones[0].photo?.alt).toBe('Door');
    });
    it('rejects a storage key that points at another organisation', () => {
      const draft = filled();
      draft.zones[0].photo = photoFor(draft);
      expect(parsePlaceDraft(draft, crypto.randomUUID())).toBeNull();
    });
    it('rejects missing alt text and rights', () => {
      const draft = filled();
      draft.zones[0].photo = photoFor(draft, { alt: '' });
      expect(parsePlaceDraft(draft, org)).toBeNull();
      draft.zones[0].photo = photoFor(draft, { rights: '' });
      expect(parsePlaceDraft(draft, org)).toBeNull();
    });
    it('rejects impossible, malformed and future dates', () => {
      const draft = filled();
      for (const photographedOn of ['2026-02-30', '02/01/2026', '2999-01-01']) {
        draft.zones[0].photo = photoFor(draft, { photographedOn });
        expect(parsePlaceDraft(draft, org)).toBeNull();
      }
    });
  });

  describe('fields per step', () => {
    it('reads a draft without hidden or own fields as nothing hidden and no own fields', () => {
      const draft = filled() as unknown as Record<string, unknown>;
      const zones = (draft.zones as Record<string, unknown>[]).map(zone => {
        const older = { ...zone };
        delete older.hidden;
        delete older.fields;
        return older;
      });
      const parsed = parsePlaceDraft({ ...draft, zones }, org);
      expect(parsed?.zones[0].hidden).toEqual([]);
      expect(parsed?.zones[0].fields).toEqual([]);
    });
    it('accepts the four removable fields once each and refuses anything else', () => {
      const draft = filled();
      draft.zones[0].hidden = ['note', 'note', 'photo'];
      expect(parsePlaceDraft(draft, org)?.zones[0].hidden).toEqual(['note', 'photo']);
      draft.zones[0].hidden = ['description' as never];
      expect(parsePlaceDraft(draft, org)).toBeNull();
    });
    it('accepts up to five own fields with a name, and keeps only what each kind uses', () => {
      const draft = filled();
      const question = { ...newOwnField('yes_no'), label: 'Seating?', value: 'ignored', answer: 'yes' as const };
      const text = { ...newOwnField('text'), label: ' Opening hours ', value: '10-18', answer: 'no' as const };
      draft.zones[0].fields = [question, text];
      const fields = parsePlaceDraft(draft, org)?.zones[0].fields;
      expect(fields?.map(f => [f.kind, f.label, f.value, f.answer])).toEqual([['yes_no', 'Seating?', '', 'yes'], ['text', 'Opening hours', '10-18', 'unanswered']]);
      draft.zones[0].fields = Array.from({ length: 6 }, () => ({ ...newOwnField('text'), label: 'Field' }));
      expect(parsePlaceDraft(draft, org)).toBeNull();
      draft.zones[0].fields = [{ ...newOwnField('text'), label: '' }];
      expect(parsePlaceDraft(draft, org)).toBeNull();
      draft.zones[0].fields = [{ ...newOwnField('text'), label: 'Field', kind: 'photo' as never }];
      expect(parsePlaceDraft(draft, org)).toBeNull();
      draft.zones[0].fields = [{ ...question, answer: 'maybe' as never }];
      expect(parsePlaceDraft(draft, org)).toBeNull();
    });
  });
});

describe('visibleZone', () => {
  it('leaves out removed fields but keeps their text in the draft', () => {
    const zone = { ...filled().zones[0], note: 'Ask staff', next: 'Go left', optional: true, hidden: ['note' as const, 'optional' as const] };
    expect(visibleZone(zone)).toMatchObject({ note: '', next: 'Go left', optional: false });
    expect(zone.note).toBe('Ask staff');
  });
  it('shows an own field only when it says something; "not answered" is never shown as no', () => {
    const zone = { ...filled().zones[0], fields: [
      { ...newOwnField('text'), label: 'Opening hours', value: '' },
      { ...newOwnField('text'), label: 'Toilets', value: 'Ground floor' },
      { ...newOwnField('yes_no'), label: 'Seating?' },
      { ...newOwnField('yes_no'), label: 'Lockers?', answer: 'no' as const },
    ] };
    expect(visibleZone(zone).fields.map(f => f.label)).toEqual(['Toilets', 'Lockers?']);
  });
});


describe('parseReportMessage', () => {
  it('trims and accepts 10 to 2000 characters', () => {
    expect(parseReportMessage('  The upload stops.  ')).toBe('The upload stops.');
    expect(parseReportMessage('x'.repeat(2000))).toHaveLength(2000);
  });
  it('rejects short, long, blank and non-text input', () => {
    expect(parseReportMessage('too short')).toBeNull();
    expect(parseReportMessage('   ' + 'x'.repeat(5) + '   ')).toBeNull();
    expect(parseReportMessage('x'.repeat(2001))).toBeNull();
    expect(parseReportMessage(null)).toBeNull();
    expect(parseReportMessage(42)).toBeNull();
  });
});
