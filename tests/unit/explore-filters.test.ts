import { describe, expect, it } from 'vitest';
import { countryName, exploreOptions, filterPlaces, noChoice, placeTypeName, showsExample, worthShowing } from '@/lib/explore-filters';
import type { PublishedPlace } from '@/lib/publishing';

const place = (slug: string, city: string, country: string, placeType: string): PublishedPlace => ({
  slug, name: slug, city, country, placeType, locale: 'en', locales: ['en'], steps: 4,
});
const places = [
  place('a-museum', 'Munich', 'DE', 'museum'),
  place('b-hotel', 'Munich', 'DE', 'hotel'),
  place('c-museum', 'Timisoara', 'RO', 'museum'),
  place('d-gallery', 'Amsterdam', 'NL', 'cultural'),
  place('e-unknown', 'Graz', '', 'other'),
];

describe('Explore filters', () => {
  it('offer only countries, cities and types that have a published guide', () => {
    const options = exploreOptions(places, noChoice, 'en');
    expect(options.countries).toEqual(['NL', 'DE', 'RO'].sort((a, b) => countryName(a, 'en').localeCompare(countryName(b, 'en'), 'en')));
    expect(options.cities).toEqual(['Amsterdam', 'Graz', 'Munich', 'Timisoara']);
    expect(options.types).toEqual(['museum', 'hotel', 'cultural', 'other']);
  });

  it('narrow the cities to the chosen country', () => {
    expect(exploreOptions(places, { ...noChoice, country: 'DE' }, 'en').cities).toEqual(['Munich']);
  });

  it('combine country, city and type', () => {
    expect(filterPlaces(places, { country: 'DE', city: 'Munich', type: 'hotel' }).map((p) => p.slug)).toEqual(['b-hotel']);
    expect(filterPlaces(places, { country: 'RO', city: '', type: 'hotel' })).toEqual([]);
    expect(filterPlaces(places, noChoice)).toHaveLength(places.length);
  });

  it('keep the fictional example only for a museum search with no country or city', () => {
    expect(showsExample(noChoice)).toBe(true);
    expect(showsExample({ ...noChoice, type: 'museum' })).toBe(true);
    expect(showsExample({ ...noChoice, type: 'hotel' })).toBe(false);
    expect(showsExample({ ...noChoice, country: 'DE' })).toBe(false);
  });

  it('name types the way the guide builder does, in every language', () => {
    expect(placeTypeName('cultural', 'en')).toBe('Cultural venue');
    expect(placeTypeName('cultural', 'de')).toBe('Kulturort');
    expect(placeTypeName('other', 'ro')).toBe('Altceva');
    expect(placeTypeName('theatre', 'en')).toBe('theatre');
  });

  it('name countries in the visitor’s language', () => {
    expect(countryName('DE', 'en')).toBe('Germany');
    expect(countryName('DE', 'de')).toBe('Deutschland');
    expect(countryName('RO', 'ro')).toBe('România');
  });

  it('hide a filter that would offer only "All"', () => {
    expect(worthShowing([])).toBe(false);
    expect(worthShowing(['DE'])).toBe(false);
    expect(worthShowing(['DE', 'RO'])).toBe(true);
  });
});
