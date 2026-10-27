'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCopy, type Locale } from '@/lib/i18n';
import { demoFacadePhoto, demoFacadePhotoSrc } from '@/lib/demo';
import { getOrganisationCopy, organisationTypes } from '@/lib/organisation-copy';
import { exploreView } from '@/lib/explore';
import type { PublishedPlace } from '@/lib/publishing';

export function ExploreCatalog({locale,places=[]}:{locale:Locale;places?:PublishedPlace[]}){
  const t=getCopy(locale);
  const typeNames=getOrganisationCopy(locale).types;
  const [country,setCountry]=useState('all');
  const [city,setCity]=useState('all');
  const [category,setCategory]=useState('all');
  const regionName=(code:string)=>new Intl.DisplayNames([locale],{type:'region'}).of(code)??code;
  const typeName=(type:string)=>typeNames[organisationTypes.indexOf(type as typeof organisationTypes[number])]??type;
  const byName=(a:string,b:string)=>a.localeCompare(b,locale);

  const view=exploreView(places,{country,city,category},byName);
  const countries=view.countries.sort((a,b)=>byName(regionName(a),regionName(b)));
  const {cities,categories,shown,showExample}=view;
  const total=(showExample?1:0)+shown.length;

  return <>
    <div className="filters">
      {places.length>0?<>
        <label className="form-field">{t.country}
          <select aria-label={t.country} value={country} onChange={event=>{setCountry(event.target.value);setCity('all');}}>
            <option value="all">{t.all}</option>
            {countries.map(code=><option key={code} value={code}>{regionName(code)}</option>)}
          </select>
        </label>
        <label className="form-field">{t.city}
          <select aria-label={t.city} value={city} onChange={event=>setCity(event.target.value)}>
            <option value="all">{t.all}</option>
            {cities.map(name=><option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </>:null}
      <label className="form-field">{t.category}
        <select aria-label={t.category} value={category} onChange={event=>setCategory(event.target.value)}>
          <option value="all">{t.all}</option>
          {categories.map(type=><option key={type} value={type}>{typeName(type)}</option>)}
        </select>
      </label>
    </div>
    <p role="status">{total?total+' '+t.results:t.noResults}</p>
    <div className="place-grid">
    {shown.map(place=><article className="place-card place-card-published" key={place.slug}><div className="place-card-content"><h2>{place.name}</h2><p>{[place.city,place.countryCode?regionName(place.countryCode):''].filter(Boolean).join(', ')}</p><p className="source-label">{t.source}</p><Link className="quiet-link" href={`/${locale}/places/${place.slug}/guide`}>{t.openGuide}<ArrowRight size={17} aria-hidden="true"/></Link></div></article>)}
    {showExample?<article className="place-card"><Image src={demoFacadePhotoSrc} alt={demoFacadePhoto[locale].alt} width={600} height={400}/><div className="place-card-content"><span className="badge">{t.fictional}</span><h2>{t.museum}</h2><p>{t.museumLocation}</p><p className="source-label">{t.source}</p><Link className="quiet-link" href={`/${locale}/places/willow-museum/guide`}>{t.openGuide}<ArrowRight size={17} aria-hidden="true"/></Link></div></article>:null}
    </div>
  </>;
}
