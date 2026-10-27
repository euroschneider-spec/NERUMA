import { organisationTypes } from './organisation-copy';
import type { PublishedPlace } from './publishing';

export type ExploreChoice = { country: string; city: string; category: string };

/**
 * What the Explore filters offer, and what they leave. Each list holds only what the published guides have, and the cities
 * follow the chosen country, so no single choice leads to an empty page by itself. 'all' means no filter.
 * The fictional example is a museum with no country or city, so any country or city choice leaves it out.
 */
export function exploreView(places: PublishedPlace[], choice: ExploreChoice, compare: (a: string, b: string) => number) {
  const inCountry = (place: PublishedPlace) => choice.country === 'all' || place.countryCode === choice.country;
  const present = new Set([...places.map((place) => place.placeType), 'museum']);
  return {
    countries: [...new Set(places.map((place) => place.countryCode).filter(Boolean))],
    cities: [...new Set(places.filter(inCountry).map((place) => place.city).filter(Boolean))].sort(compare),
    categories: organisationTypes.filter((type) => present.has(type)),
    shown: places.filter((place) => inCountry(place) && (choice.city === 'all' || place.city === choice.city) && (choice.category === 'all' || place.placeType === choice.category)),
    showExample: choice.country === 'all' && choice.city === 'all' && (choice.category === 'all' || choice.category === 'museum'),
  };
}
