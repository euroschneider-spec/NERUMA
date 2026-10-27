import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ExploreCatalog } from '@/components/explore-catalog';
import type { PublishedPlace } from '@/lib/publishing';

const place = (slug: string, city: string, countryCode: string, placeType: string): PublishedPlace => ({
  slug, name: `Name ${slug}`, city, countryCode, placeType, locale: 'en', locales: ['en'], steps: 3,
});
const places = [
  place('munich-museum', 'Munich', 'DE', 'museum'),
  place('munich-hotel', 'Munich', 'DE', 'hotel'),
  place('berlin-hotel', 'Berlin', 'DE', 'hotel'),
  place('cluj-gallery', 'Cluj', 'RO', 'cultural'),
];

let container: HTMLDivElement;
let root: Root;
const select = (label: string) => container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
const optionNames = (label: string) => [...select(label)!.options].map((option) => option.textContent);
const cardNames = () => [...container.querySelectorAll('article h2')].map((heading) => heading.textContent);
const status = () => container.querySelector('[role=status]')?.textContent;
const clearButton = () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Clear filters');
const choose = (label: string, value: string) => act(() => {
  const element = select(label)!;
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
});
const mount = (list: PublishedPlace[]) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<ExploreCatalog locale="en" places={list} />); });
};

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('the Explore filters on the page', () => {
  it('narrow the cities and the cards when a country is chosen', () => {
    mount(places);
    expect(optionNames('City')).toEqual(['All', 'Berlin', 'Cluj', 'Munich']);
    choose('Country', 'DE');
    expect(optionNames('City')).toEqual(['All', 'Berlin', 'Munich']);
    expect(cardNames()).toEqual(['Name munich-museum', 'Name munich-hotel', 'Name berlin-hotel']);
    choose('City', 'Munich');
    choose('Category', 'hotel');
    expect(cardNames()).toEqual(['Name munich-hotel']);
  });

  it('forget a city that does not belong to the newly chosen country', () => {
    mount(places);
    choose('Country', 'DE');
    choose('City', 'Munich');
    choose('Country', 'RO');
    expect(select('City')!.value).toBe('all');
    expect(cardNames()).toEqual(['Name cluj-gallery']);
  });

  it('offer no "Clear filters" button while something matches', () => {
    mount(places);
    expect(clearButton()).toBeUndefined();
    choose('Country', 'DE');
    expect(clearButton()).toBeUndefined();
  });

  it('say so and offer "Clear filters" when nothing matches, and clear them', () => {
    mount(places);
    choose('Country', 'RO');
    choose('Category', 'hotel');
    expect(status()).toBe('No guide matches these filters.');
    act(() => { clearButton()!.click(); });
    expect(select('Country')!.value).toBe('all');
    expect(select('City')!.value).toBe('all');
    expect(select('Category')!.value).toBe('all');
    expect(clearButton()).toBeUndefined();
    expect(cardNames()).toHaveLength(places.length + 1); // and the fictional example
  });
});
