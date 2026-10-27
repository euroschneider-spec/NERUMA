'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { demoFacadePhoto, demoFacadePhotoSrc } from '@/lib/demo';
import { countryName, exploreOptions, filterPlaces, noChoice, placeTypeName, showsExample, worthShowing, type ExploreChoice } from '@/lib/explore-filters';
import type { PublishedPlace } from '@/lib/publishing';

type FilterProps = { label: string; all: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void };

function Filter({ label, all, value, options, onChange }: FilterProps) {
  return (
    <label className="form-field">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{all}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function ExploreCatalog({ locale, places = [] }: { locale: Locale; places?: PublishedPlace[] }) {
  const t = getCopy(locale);
  const [choice, setChoice] = useState<ExploreChoice>(noChoice);
  const options = exploreOptions(places, choice, locale);
  const shown = filterPlaces(places, choice);
  const showExample = showsExample(choice);
  const total = (showExample ? 1 : 0) + shown.length;
  const anyFilter = [options.countries, options.cities, options.types].some(worthShowing);
  return (
    <>
      {anyFilter ? (
        <div className="filters">
          {worthShowing(options.countries) ? (
            <Filter label={t.country} all={t.all} value={choice.country} onChange={(country) => setChoice({ ...choice, country, city: '' })}
              options={options.countries.map((code) => ({ value: code, label: countryName(code, locale) }))} />
          ) : null}
          {worthShowing(options.cities) ? (
            <Filter label={t.city} all={t.all} value={choice.city} onChange={(city) => setChoice({ ...choice, city })}
              options={options.cities.map((city) => ({ value: city, label: city }))} />
          ) : null}
          {worthShowing(options.types) ? (
            <Filter label={t.category} all={t.all} value={choice.type} onChange={(type) => setChoice({ ...choice, type })}
              options={options.types.map((type) => ({ value: type, label: placeTypeName(type, locale) }))} />
          ) : null}
        </div>
      ) : null}
      <p role="status">{total ? total + ' ' + t.results : t.noResults}</p>
      {total === 0 ? <button type="button" className="button button-outline" onClick={() => setChoice(noChoice)}>{t.clearFilters}</button> : null}
      {shown.map((place) => (
        <article className="place-card place-card-published" key={place.slug}>
          <div className="place-card-content">
            <h2>{place.name}</h2>
            <p>{place.city}</p>
            <p className="source-label">{t.source}</p>
            <Link className="quiet-link" href={`/${locale}/places/${place.slug}/guide`}>{t.openGuide}<ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </article>
      ))}
      {showExample ? (
        <article className="place-card">
          <Image src={demoFacadePhotoSrc} alt={demoFacadePhoto[locale].alt} width={600} height={400} />
          <div className="place-card-content">
            <span className="badge">{t.fictional}</span>
            <h2>{t.museum}</h2>
            <p>{t.museumLocation}</p>
            <p className="source-label">{t.source}</p>
            <Link className="quiet-link" href={`/${locale}/places/willow-museum/guide`}>{t.openGuide}<ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </article>
      ) : null}
    </>
  );
}
