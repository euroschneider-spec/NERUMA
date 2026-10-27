import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ExploreCatalog } from '@/components/explore-catalog';
import type { PublishedPlace } from '@/lib/publishing';

const place = (slug: string, city: string, country: string, placeType: string): PublishedPlace => ({
  slug, name: `Name ${slug}`, city, country, placeType, locale: 'en', locales: ['en'], steps: 4,
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
const names = () => [...container.querySelectorAll('article h2')].map((heading) => heading.textContent);
const choose = (label: string, value: string) => act(() => {
  const element = select(label)!;
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
});
const render = (list: PublishedPlace[]) => act(() => { root.render(<ExploreCatalog locale="en" places={list} />); });

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const mount = (list: PublishedPlace[]) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  render(list);
};

describe('Explore catalog filters', () => {
  it('show no filters while only the example exists', () => {
    mount([]);
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelector('[role=status]')?.textContent).toBe('1 guide found');
  });

  it('narrow the cities and the cards when a country is chosen', () => {
    mount(places);
    expect([...select('City')!.options].map((option) => option.textContent)).toEqual(['All', 'Berlin', 'Cluj', 'Munich']);
    choose('Country', 'DE');
    expect([...select('City')!.options].map((option) => option.textContent)).toEqual(['All', 'Berlin', 'Munich']);
    expect(names()).toEqual(['Name munich-museum', 'Name munich-hotel', 'Name berlin-hotel']);
    choose('City', 'Munich');
    choose('Category', 'hotel');
    expect(names()).toEqual(['Name munich-hotel']);
  });

  it('forget a city that does not belong to the newly chosen country', () => {
    mount(places);
    choose('Country', 'DE');
    choose('City', 'Munich');
    choose('Country', 'RO');
    expect(select('City')).toBeNull();
    expect(names()).toEqual(['Name cluj-gallery']);
  });

  it('offer only the types that exist, named as the guide builder names them', () => {
    mount(places);
    expect([...select('Category')!.options].map((option) => option.textContent)).toEqual(['All', 'Museum', 'Hotel', 'Cultural venue']);
  });

  it('say so and offer "Clear filters" when nothing matches, and clear them', () => {
    mount(places);
    choose('Country', 'RO');
    choose('Category', 'hotel');
    expect(container.querySelector('[role=status]')?.textContent).toBe('No guide matches these filters.');
    const clear = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Clear filters')!;
    act(() => { clear.click(); });
    expect(select('Country')!.value).toBe('');
    expect(names()).toHaveLength(places.length + 1); // and the fictional example
  });
});
