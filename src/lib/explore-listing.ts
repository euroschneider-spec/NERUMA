import type { Locale } from './i18n';

// Explore is a feature a platform administrator switches on per organisation, and the organisation can then hide single
// locations (brief docs/briefs/2026-10-27-show-in-explore.md). RO and DE are drafts that need a native speaker.
const en = {
  // The platform administrator's side, on the account page, beside Visit.
  adminLabel: 'Explore',
  adminOn: 'Explore is on: published locations are listed in Explore unless the organisation hides them.',
  adminOff: 'Explore is off: none of this organisation’s locations are listed in Explore.',
  switchOn: 'Switch on Explore',
  switchOff: 'Switch off Explore',
  switchOnAria: 'Switch on Explore for {name}',
  switchOffAria: 'Switch off Explore for {name}',
  offTitle: 'Switch off Explore for {name}?',
  offBody: 'Its locations leave Explore at once and the organisation loses its “Show in Explore” switch. Guides and QR codes keep working, and each location’s own choice is kept for when Explore is switched on again.',
  offConfirm: 'Switch off Explore',
  offCancel: 'Keep it on',
  adminError: 'Explore could not be changed. Try again.',
  // The organisation's side, on each location card.
  show: 'Show in Explore',
  showOff: 'Explore listing is not switched on for your organisation. Contact NERUMA to enable it.',
  showHint: 'Visitors can find this location in Explore. Its guide and QR code work either way.',
  saved: 'Saved.',
  error: 'This could not be saved. Try again.',
};
type ExploreListingCopy = typeof en;

const ro: ExploreListingCopy = {
  adminLabel: 'Explorează',
  adminOn: 'Explorează este activ: locațiile publicate apar în Explorează, în afară de cele ascunse de organizație.',
  adminOff: 'Explorează este dezactivat: nicio locație a acestei organizații nu apare în Explorează.',
  switchOn: 'Activează Explorează',
  switchOff: 'Dezactivează Explorează',
  switchOnAria: 'Activează Explorează pentru {name}',
  switchOffAria: 'Dezactivează Explorează pentru {name}',
  offTitle: 'Dezactivezi Explorează pentru {name}?',
  offBody: 'Locațiile ei dispar imediat din Explorează, iar organizația pierde comutatorul „Arată în Explorează”. Ghidurile și codurile QR continuă să funcționeze, iar alegerea fiecărei locații se păstrează pentru când Explorează va fi activat din nou.',
  offConfirm: 'Dezactivează Explorează',
  offCancel: 'Las-o activă',
  adminError: 'Explorează nu a putut fi modificat. Încearcă din nou.',
  show: 'Arată în Explorează',
  showOff: 'Listarea în Explorează nu este activată pentru organizația ta. Contactează NERUMA pentru a o activa.',
  showHint: 'Vizitatorii pot găsi această locație în Explorează. Ghidul și codul QR funcționează oricum.',
  saved: 'Salvat.',
  error: 'Nu s-a putut salva. Încearcă din nou.',
};

const de: ExploreListingCopy = {
  adminLabel: 'Entdecken',
  adminOn: 'Entdecken ist an: Veröffentlichte Orte erscheinen in Entdecken, außer die Organisation blendet sie aus.',
  adminOff: 'Entdecken ist aus: Kein Ort dieser Organisation erscheint in Entdecken.',
  switchOn: 'Entdecken einschalten',
  switchOff: 'Entdecken ausschalten',
  switchOnAria: 'Entdecken für {name} einschalten',
  switchOffAria: 'Entdecken für {name} ausschalten',
  offTitle: 'Entdecken für {name} ausschalten?',
  offBody: 'Die Orte verschwinden sofort aus Entdecken, und die Organisation verliert den Schalter „In Entdecken zeigen“. Guides und QR-Codes funktionieren weiter, und die Wahl jedes Ortes bleibt für ein erneutes Einschalten erhalten.',
  offConfirm: 'Entdecken ausschalten',
  offCancel: 'Eingeschaltet lassen',
  adminError: 'Entdecken konnte nicht geändert werden. Versuchen Sie es erneut.',
  show: 'In Entdecken zeigen',
  showOff: 'Die Auflistung in Entdecken ist für Ihre Organisation nicht eingeschaltet. Kontaktieren Sie NERUMA, um sie zu aktivieren.',
  showHint: 'Besuchende können diesen Ort in Entdecken finden. Guide und QR-Code funktionieren in jedem Fall.',
  saved: 'Gespeichert.',
  error: 'Das konnte nicht gespeichert werden. Versuchen Sie es erneut.',
};

export const getExploreListingCopy = (locale: Locale): ExploreListingCopy => ({ en, ro, de })[locale];
