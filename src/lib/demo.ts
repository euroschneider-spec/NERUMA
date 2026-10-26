import type { Locale } from './i18n';
export type SensoryLevel = 'low' | 'moderate' | 'high' | 'variable' | 'unknown';
export type SensoryProfile = Record<'sound' | 'light' | 'crowding' | 'smell' | 'temperature' | 'visual', SensoryLevel>;
/** `src` is set for a published photo; the example guide uses its illustration instead. */
export type ZonePhoto = { id: string; alt: string; rights: string; photographedOn: string; src?: string };
export type ZoneField = { label: string; kind: 'text' | 'yes_no'; value: string; answer: 'yes' | 'no' | 'unanswered' };
export type Zone = { id: string; title: string; description: string; note: string; next: string; illustration: string; sensory: SensoryProfile; photo?: ZonePhoto; optional?: boolean; fields?: ZoneField[] };
/** The example guide (`isDemo`) or a published one, which has its own description and arrival text. */
export type Guide = { schemaVersion: 1; title: string; locale: Locale; zones: Zone[]; sourceLevel: 'venue_provided'; isDemo: boolean; description?: string; arrival?: string };
const profiles: SensoryProfile[] = [
  { sound:'variable', light:'moderate', crowding:'variable', smell:'low', temperature:'variable', visual:'low' },
  { sound:'moderate', light:'moderate', crowding:'variable', smell:'low', temperature:'moderate', visual:'moderate' },
  { sound:'low', light:'moderate', crowding:'low', smell:'low', temperature:'moderate', visual:'moderate' },
  { sound:'variable', light:'variable', crowding:'moderate', smell:'low', temperature:'moderate', visual:'high' },
  { sound:'low', light:'low', crowding:'low', smell:'low', temperature:'moderate', visual:'low' }
];
const content: Record<Locale, string[][]> = {
  en: [
    ['The main entrance', 'A wide, step-free path crosses the square to a covered entrance between tall stone columns. The doorway sits under an arch. The doors open automatically.', 'Street sounds may be noticeable. You can pause in the shade of the columns before entering.', 'Go through the doors. Reception is on your left.'],
    ['Reception & the foyer', 'The reception desk is on your left. A staff member can explain the route. Toilets are along the corridor to the right.', 'Groups may gather here. Ask about a shorter route or a quieter place to wait.', 'Continue straight ahead to the first gallery.'],
    ['The collection gallery', 'Paintings hang on pale walls. There are benches in the centre. This example room has no background music.', 'Light is steady. You can walk around the room in either direction.', 'The next space is the interactive gallery. You can also go directly to the quiet room.'],
    ['The interactive gallery', 'The interactive gallery is in the new wing, a modern building with deep-set windows. Inside, screens and hands-on displays fill the room. Some exhibits produce short sounds. Screen brightness can change.', 'You can skip this room. Staff can show you the route to the quiet room.', 'Continue to the quiet room, or return to reception.'],
    ['The quiet room', 'This small room has softer light, chairs and a window overlooking a garden. In this example, it is available throughout the visit.', 'Use the space for a pause. Ask staff if it is occupied. The room is not soundproof.', 'When you are ready, return to reception to leave or continue your visit.']
  ],
  ro: [
    ['Intrarea principală', 'Un traseu larg, fără trepte, traversează piața până la o intrare acoperită, între coloane înalte de piatră. Ușa se află sub o arcadă. Ușile se deschid automat.', 'Se pot auzi sunete de pe stradă. Poți lua o pauză la umbra coloanelor înainte de intrare.', 'Treci prin uși. Recepția este în stânga.'],
    ['Recepția și holul', 'Recepția este în stânga. Un membru al echipei poate explica traseul. Toaletele sunt pe coridorul din dreapta.', 'Aici se pot aduna grupuri. Poți cere un traseu mai scurt sau un loc mai liniștit pentru așteptare.', 'Mergi înainte spre prima galerie.'],
    ['Galeria colecției', 'Tablourile sunt expuse pe pereți deschiși la culoare. În centru sunt bănci. În această sală exemplu nu există muzică de fundal.', 'Lumina este constantă. Poți parcurge sala în ambele direcții.', 'Urmează galeria interactivă. Poți merge și direct la camera liniștită.'],
    ['Galeria interactivă', 'Galeria interactivă se află în aripa nouă, o clădire modernă cu ferestre adânci. Înăuntru, sala este plină de ecrane și exponate interactive. Unele emit sunete scurte. Luminozitatea ecranelor se poate schimba.', 'Poți sări această sală. Personalul îți poate arăta traseul către camera liniștită.', 'Continuă spre camera liniștită sau revino la recepție.'],
    ['Camera liniștită', 'Această cameră mică are lumină mai blândă, scaune și o fereastră spre grădină. În exemplu, este disponibilă pe parcursul vizitei.', 'Poți lua o pauză aici. Întreabă personalul dacă este ocupată. Camera nu este izolată fonic.', 'Când ești pregătit, revino la recepție pentru a ieși sau a continua vizita.']
  ],
  de: [
    ['Der Haupteingang', 'Ein breiter, stufenloser Weg führt über den Platz zu einem überdachten Eingang zwischen hohen Steinsäulen. Die Tür liegt unter einem Rundbogen. Die Türen öffnen automatisch.', 'Straßengeräusche können hörbar sein. Im Schatten der Säulen können Sie vor dem Eintritt pausieren.', 'Gehen Sie durch die Türen. Der Empfang liegt links.'],
    ['Empfang & Foyer', 'Der Empfang liegt links. Das Personal kann den Weg erklären. Toiletten befinden sich im rechten Flur.', 'Hier können sich Gruppen sammeln. Fragen Sie nach einem kürzeren Weg oder einem ruhigeren Warteplatz.', 'Gehen Sie geradeaus zur ersten Galerie.'],
    ['Die Sammlungsgalerie', 'Gemälde hängen an hellen Wänden. In der Mitte stehen Bänke. In diesem Beispielraum gibt es keine Hintergrundmusik.', 'Das Licht ist gleichmäßig. Sie können in beide Richtungen durch den Raum gehen.', 'Als Nächstes folgt die interaktive Galerie. Sie können auch direkt zum Ruheraum gehen.'],
    ['Die interaktive Galerie', 'Die interaktive Galerie liegt im neuen Flügel, einem modernen Bau mit tiefen Fensternischen. Drinnen gibt es Bildschirme und interaktive Stationen. Einige erzeugen kurze Geräusche. Die Helligkeit kann wechseln.', 'Sie können diesen Raum überspringen. Das Personal zeigt den Weg zum Ruheraum.', 'Weiter zum Ruheraum oder zurück zum Empfang.'],
    ['Der Ruheraum', 'Dieser kleine Raum bietet weicheres Licht, Stühle und ein Gartenfenster. Im Beispiel ist er während des Besuchs verfügbar.', 'Nutzen Sie den Raum für eine Pause. Fragen Sie, ob er besetzt ist. Er ist nicht schalldicht.', 'Kehren Sie zum Empfang zurück, um zu gehen oder den Besuch fortzusetzen.']
  ]
};
/** The first two sample photographs come from Unsplash (free to use, no credit needed); the third is a free-to-use stock photo. */
const unsplashRights: Record<Locale, string> = {
  en: 'Photo from Unsplash, free to use under the Unsplash licence; used as an example',
  ro: 'Fotografie de pe Unsplash, liberă de utilizat conform licenței Unsplash; folosită ca exemplu',
  de: 'Foto von Unsplash, frei nutzbar unter der Unsplash-Lizenz; als Beispiel verwendet'
};
const stockRights: Record<Locale, string> = {
  en: 'Free-to-use stock photo, used as an example',
  ro: 'Fotografie stock liberă de utilizat, folosită ca exemplu',
  de: 'Frei nutzbares Stockfoto, als Beispiel verwendet'
};
/** The entrance step of the example guide shows a photograph; the other steps use the site's illustrations. */
export const demoEntrancePhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'A sandstone building with tall columns and an arched doorway; a plaque above it reads BIBLIOTHECA', rights: unsplashRights.en },
  ro: { alt: 'O clădire din gresie cu coloane înalte și o ușă în arcadă; deasupra ei, o placă cu inscripția BIBLIOTHECA', rights: unsplashRights.ro },
  de: { alt: 'Ein Sandsteingebäude mit hohen Säulen und einem Rundbogenportal; darüber eine Tafel mit der Aufschrift BIBLIOTHECA', rights: unsplashRights.de }
};
/** The second sample photograph, on the example card in Explore. */
export const demoFacadePhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'A red brick building with an orange canopy and the word LIBRARY in large white letters under a blue sky', rights: unsplashRights.en },
  ro: { alt: 'O clădire din cărămidă roșie cu o copertină portocalie și cuvântul LIBRARY cu litere mari albe sub un cer albastru', rights: unsplashRights.ro },
  de: { alt: 'Ein rotes Backsteingebäude mit orangefarbenem Vordach und dem Wort LIBRARY in großen weißen Buchstaben unter blauem Himmel', rights: unsplashRights.de }
};
export const demoFacadePhotoSrc = '/photos/facade.jpg';
/** The fourth: the interactive gallery step of the example guide and the demo workspace, shown from outside as the new wing. */
export const demoWingPhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'The corner of a modern grey building with deep-set windows and a patterned metal front, seen from below against a dark sky', rights: stockRights.en },
  ro: { alt: 'Colțul unei clădiri moderne gri, cu ferestre adânci și fațadă metalică cu model, văzut de jos pe un cer întunecat', rights: stockRights.ro },
  de: { alt: 'Die Ecke eines modernen grauen Gebäudes mit tiefen Fensternischen und gemusterter Metallfassade, von unten vor dunklem Himmel', rights: stockRights.de }
};
export const demoWingPhotoSrc = '/photos/wing.jpg';
/** The third: the Garden Pavilion's first step in the demo workspace, which is also the picture on its dashboard card. */
export const demoPavilionPhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'A curved glass building in shades of blue, with a white wavy band of thin vertical fins wrapped around it', rights: stockRights.en },
  ro: { alt: 'O clădire curbată din sticlă în nuanțe de albastru, înconjurată de o bandă albă ondulată de lamele verticale subțiri', rights: stockRights.ro },
  de: { alt: 'Ein geschwungenes Glasgebäude in Blautönen, umgeben von einem weißen, wellenförmigen Band aus dünnen senkrechten Lamellen', rights: stockRights.de }
};
export const demoPavilionPhotoSrc = '/photos/pavilion.jpg';
export const demoEntrancePhotoSrc = '/photos/entrance.jpg';
export const demoEntrancePhotoDate = '2026-09-01';
export function getDemoGuide(locale: Locale): Guide {
  return { schemaVersion:1, title: locale==='en' ? 'The Willow Museum' : locale==='ro' ? 'Muzeul Willow' : 'Das Willow Museum', locale, sourceLevel:'venue_provided', isDemo:true,
    zones: content[locale].map(([title,description,note,next], i) => ({ id:['entrance','reception','collection','interactive','quiet-room'][i], title,description,note,next, illustration:`/illustrations/${['entrance','reception','collection','interactive','quiet-room'][i]}.svg`, sensory: profiles[i], photo: i===0 ? { id:'entrance', src:demoEntrancePhotoSrc, photographedOn:demoEntrancePhotoDate, ...demoEntrancePhoto[locale] } : i===3 ? { id:'interactive', src:demoWingPhotoSrc, photographedOn:demoEntrancePhotoDate, ...demoWingPhoto[locale] } : undefined })) };
}
