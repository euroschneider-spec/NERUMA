import { getOrganisationCopy } from '@/lib/organisation-copy';
import { getWorkspaceCopy, placeTypes } from '@/lib/workspace';
import type { Locale } from '@/lib/i18n';
import type { PublishedPlace } from '@/lib/publishing';

/** What the visitor picked. An empty string means "All". */
export type ExploreChoice = { country: string; city: string; type: string };
export const noChoice: ExploreChoice = { country: '', city: '', type: '' };

export type ExploreOptions = { countries: string[]; cities: string[]; types: string[] };

const sorted = (values: Iterable<string>, locale: Locale) => [...new Set(values)].sort((a, b) => a.localeCompare(b, locale));

/** The country's name in the visitor's language; the code itself when the browser cannot name it. */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The type's name in the visitor's language, the same words the guide builder uses. */
export function placeTypeName(type: string, locale: Locale): string {
  const index = placeTypes.indexOf(type as typeof placeTypes[number]);
  if (index < 0) return type;
  return type === 'other' ? getWorkspaceCopy(locale).kindOther : getOrganisationCopy(locale).types[index];
}

/** Only what exists: values that at least one published guide has. Cities follow the chosen country. */
export function exploreOptions(places: PublishedPlace[], choice: ExploreChoice, locale: Locale): ExploreOptions {
  const countries = sorted(places.map((place) => place.country).filter(Boolean), locale)
    .sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale));
  const inCountry = places.filter((place) => !choice.country || place.country === choice.country);
  const cities = sorted(inCountry.map((place) => place.city.trim()).filter(Boolean), locale);
  const present = new Set(places.map((place) => place.placeType));
  const types = placeTypes.filter((type) => present.has(type)) as string[];
  return { countries, cities, types };
}

export function filterPlaces(places: PublishedPlace[], choice: ExploreChoice): PublishedPlace[] {
  return places.filter((place) => (!choice.country || place.country === choice.country)
    && (!choice.city || place.city.trim() === choice.city)
    && (!choice.type || place.placeType === choice.type));
}

/** The fictional example is a museum with no country or city, so any country or city choice leaves it out. */
export const showsExample = (choice: ExploreChoice) => !choice.country && !choice.city && (!choice.type || choice.type === 'museum');

/** A filter with fewer than two choices would offer only "All", so it stays hidden. */
export const worthShowing = (values: string[]) => values.length >= 2;
