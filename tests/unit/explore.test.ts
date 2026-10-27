import { describe, expect, it } from 'vitest';
import { exploreView } from '@/lib/explore';
import type { PublishedPlace } from '@/lib/publishing';

const place = (slug: string, city: string, countryCode: string, placeType: string): PublishedPlace => ({ slug, name: slug, city, countryCode, placeType, locale: 'en', locales: ['en'], steps: 3 });
const places = [
  place('cluj', 'Cluj-Napoca', 'RO', 'museum'),
  place('sibiu', 'Sibiu', 'RO', 'hotel'),
  place('wien', 'Wien', 'AT', 'museum'),
  place('graz', 'Graz', 'AT', 'public_service'),
];
const all = { country: 'all', city: 'all', category: 'all' };
const compare = (a: string, b: string) => a.localeCompare(b, 'en');

describe('the Explore filters', () => {
  it('offer only what the published guides have, and Museum for the example', () => {
    const view = exploreView(places, all, compare);
    expect(view.countries.sort()).toEqual(['AT', 'RO']);
    expect(view.cities).toEqual(['Cluj-Napoca', 'Graz', 'Sibiu', 'Wien']);
    expect(view.categories).toEqual(['museum', 'hotel', 'public_service']);
    expect(exploreView([], all, compare).categories).toEqual(['museum']);
  });
  it('narrow the cities to the chosen country', () => {
    expect(exploreView(places, { ...all, country: 'AT' }, compare).cities).toEqual(['Graz', 'Wien']);
  });
  it('combine, and leave out the fictional example as soon as a country or city is chosen', () => {
    expect(exploreView(places, { country: 'RO', city: 'all', category: 'museum' }, compare).shown.map((entry) => entry.slug)).toEqual(['cluj']);
    expect(exploreView(places, { country: 'all', city: 'Wien', category: 'all' }, compare).shown.map((entry) => entry.slug)).toEqual(['wien']);
    expect(exploreView(places, all, compare).showExample).toBe(true);
    expect(exploreView(places, { ...all, category: 'museum' }, compare).showExample).toBe(true);
    expect(exploreView(places, { ...all, category: 'hotel' }, compare).showExample).toBe(false);
    expect(exploreView(places, { ...all, country: 'RO' }, compare).showExample).toBe(false);
  });
  it('may find nothing for a combination that does not exist', () => {
    expect(exploreView(places, { country: 'AT', city: 'all', category: 'hotel' }, compare).shown).toEqual([]);
  });
});
