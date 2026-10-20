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
    ['The main entrance', 'A wide, step-free path leads to the glass doors. There is a bench beside the entrance. The doors open automatically.', 'Street sounds may be noticeable. You can pause on the bench before entering.', 'Go through the doors. Reception is on your left.'],
    ['Reception & the foyer', 'The reception desk is on your left. A staff member can explain the route. Toilets are along the corridor to the right.', 'Groups may gather here. Ask about a shorter route or a quieter place to wait.', 'Continue straight ahead to the first gallery.'],
    ['The collection gallery', 'Paintings hang on pale walls. There are benches in the centre. This example room has no background music.', 'Light is steady. You can walk around the room in either direction.', 'The next space is the interactive gallery. You can also go directly to the quiet room.'],
    ['The interactive gallery', 'Screens and hands-on displays fill this room. Some exhibits produce short sounds. Screen brightness can change.', 'You can skip this room. Staff can show you the route to the quiet room.', 'Continue to the quiet room, or return to reception.'],
    ['The quiet room', 'This small room has softer light, chairs and a window overlooking a garden. In this example, it is available throughout the visit.', 'Use the space for a pause. Ask staff if it is occupied. The room is not soundproof.', 'When you are ready, return to reception to leave or continue your visit.']
  ],
  ro: [
    ['Intrarea principală', 'Un traseu larg, fără trepte, duce la ușile de sticlă. Lângă intrare se află o bancă. Ușile se deschid automat.', 'Se pot auzi sunete de pe stradă. Poți lua o pauză pe bancă înainte de intrare.', 'Treci prin uși. Recepția este în stânga.'],
    ['Recepția și holul', 'Recepția este în stânga. Un membru al echipei poate explica traseul. Toaletele sunt pe coridorul din dreapta.', 'Aici se pot aduna grupuri. Poți cere un traseu mai scurt sau un loc mai liniștit pentru așteptare.', 'Mergi înainte spre prima galerie.'],
    ['Galeria colecției', 'Tablourile sunt expuse pe pereți deschiși la culoare. În centru sunt bănci. În această sală exemplu nu există muzică de fundal.', 'Lumina este constantă. Poți parcurge sala în ambele direcții.', 'Urmează galeria interactivă. Poți merge și direct la camera liniștită.'],
    ['Galeria interactivă', 'În sală sunt ecrane și exponate interactive. Unele emit sunete scurte. Luminozitatea ecranelor se poate schimba.', 'Poți sări această sală. Personalul îți poate arăta traseul către camera liniștită.', 'Continuă spre camera liniștită sau revino la recepție.'],
    ['Camera liniștită', 'Această cameră mică are lumină mai blândă, scaune și o fereastră spre grădină. În exemplu, este disponibilă pe parcursul vizitei.', 'Poți lua o pauză aici. Întreabă personalul dacă este ocupată. Camera nu este izolată fonic.', 'Când ești pregătit, revino la recepție pentru a ieși sau a continua vizita.']
  ],
  de: [
    ['Der Haupteingang', 'Ein breiter, stufenloser Weg führt zu den Glastüren. Neben dem Eingang steht eine Bank. Die Türen öffnen automatisch.', 'Straßengeräusche können hörbar sein. Auf der Bank können Sie vor dem Eintritt pausieren.', 'Gehen Sie durch die Türen. Der Empfang liegt links.'],
    ['Empfang & Foyer', 'Der Empfang liegt links. Das Personal kann den Weg erklären. Toiletten befinden sich im rechten Flur.', 'Hier können sich Gruppen sammeln. Fragen Sie nach einem kürzeren Weg oder einem ruhigeren Warteplatz.', 'Gehen Sie geradeaus zur ersten Galerie.'],
    ['Die Sammlungsgalerie', 'Gemälde hängen an hellen Wänden. In der Mitte stehen Bänke. In diesem Beispielraum gibt es keine Hintergrundmusik.', 'Das Licht ist gleichmäßig. Sie können in beide Richtungen durch den Raum gehen.', 'Als Nächstes folgt die interaktive Galerie. Sie können auch direkt zum Ruheraum gehen.'],
    ['Die interaktive Galerie', 'Bildschirme und interaktive Stationen füllen den Raum. Einige erzeugen kurze Geräusche. Die Bildschirmhelligkeit kann wechseln.', 'Sie können diesen Raum überspringen. Das Personal zeigt den Weg zum Ruheraum.', 'Weiter zum Ruheraum oder zurück zum Empfang.'],
    ['Der Ruheraum', 'Dieser kleine Raum bietet weicheres Licht, Stühle und ein Gartenfenster. Im Beispiel ist er während des Besuchs verfügbar.', 'Nutzen Sie den Raum für eine Pause. Fragen Sie, ob er besetzt ist. Er ist nicht schalldicht.', 'Kehren Sie zum Empfang zurück, um zu gehen oder den Besuch fortzusetzen.']
  ]
};
/** The entrance step of the example guide shows a photograph; the other steps use the site's illustrations. */
export const demoEntrancePhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'A stone-clad museum building with a glass entrance at street level', rights: 'Photo supplied by the project owner, used as an example' },
  ro: { alt: 'O clădire de muzeu placată cu piatră, cu intrare de sticlă la nivelul străzii', rights: 'Fotografie furnizată de proprietarul proiectului, folosită ca exemplu' },
  de: { alt: 'Ein steinverkleidetes Museumsgebäude mit gläsernem Eingang auf Straßenebene', rights: 'Foto vom Projektinhaber, als Beispiel verwendet' }
};
/** The second sample photograph: the Garden Pavilion's first step in the demo workspace, and the example card in Explore. */
export const demoFacadePhoto: Record<Locale, { alt: string; rights: string }> = {
  en: { alt: 'A museum building covered in thin vertical rods in red, orange, green and blue, with a band of dark glass above a covered walkway', rights: demoEntrancePhoto.en.rights },
  ro: { alt: 'O clădire de muzeu acoperită cu bare verticale subțiri roșii, portocalii, verzi și albastre, cu o bandă de sticlă închisă deasupra unei treceri acoperite', rights: demoEntrancePhoto.ro.rights },
  de: { alt: 'Ein Museumsgebäude, verkleidet mit dünnen senkrechten Stäben in Rot, Orange, Grün und Blau, mit einem dunklen Glasband über einem überdachten Gehweg', rights: demoEntrancePhoto.de.rights }
};
export const demoFacadePhotoSrc = '/photos/pavilion.jpg';
export const demoEntrancePhotoSrc = '/photos/entrance.jpg';
export const demoEntrancePhotoDate = '2026-09-01';
export function getDemoGuide(locale: Locale): Guide {
  return { schemaVersion:1, title: locale==='en' ? 'The Willow Museum' : locale==='ro' ? 'Muzeul Willow' : 'Das Willow Museum', locale, sourceLevel:'venue_provided', isDemo:true,
    zones: content[locale].map(([title,description,note,next], i) => ({ id:['entrance','reception','collection','interactive','quiet-room'][i], title,description,note,next, illustration:`/illustrations/${['entrance','reception','collection','interactive','quiet-room'][i]}.svg`, sensory: profiles[i], photo: i===0 ? { id:'entrance', src:demoEntrancePhotoSrc, photographedOn:demoEntrancePhotoDate, ...demoEntrancePhoto[locale] } : undefined })) };
}
