// The words of the synthetic places. Every institution is fictional, and every name says so. Text is written as an
// organisation would write it: plain, specific, honest about what is loud, bright or busy.
const step = (title, description, note, next) => ({ title, description, note, next });
const levels = (sound, light, crowding, smell, temperature, visual) => ({ sound, light, crowding, smell, temperature, visual });

// ---------------------------------------------------------------------------------------------------------------------
// Muzeul de Artă Vizuală Cluj: the full example. Eight steps, three languages, own fields, a removed field, photos.
// ---------------------------------------------------------------------------------------------------------------------
export const cluj = {
  type: 'museum', city: 'Cluj-Napoca', country: 'RO',
  zones: [
    { type: 'entrance', photo: true, sensory: levels('moderate', 'high', 'variable', 'low', 'moderate', 'moderate') },
    { type: 'reception', photo: true, sensory: levels('moderate', 'moderate', 'variable', 'low', 'moderate', 'low') },
    { type: 'collection', photo: true, sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'moderate') },
    { type: 'interactive', sensory: levels('high', 'low', 'variable', 'low', 'moderate', 'high'), fields: [
      { kind: 'yes_no', answer: 'yes' }, { kind: 'text' }] },
    { type: 'workshop', hidden: ['note'], sensory: levels('high', 'high', 'high', 'moderate', 'moderate', 'high') },
    { type: 'quiet-room', sensory: levels('low', 'low', 'low', 'low', 'moderate', 'low') },
    { type: 'cafe', sensory: levels('high', 'moderate', 'high', 'high', 'moderate', 'moderate') },
    { type: 'exit', sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'moderate') },
  ],
  en: {
    name: 'Visual Arts Museum Cluj (fictional)', address: 'Strada Muzeului 12',
    description: 'A museum of 19th and 20th century painting and contemporary video art, on four floors of a former bank building.',
    arrivalInfo: 'Trams 101 and 102 stop 80 metres from the door. The step-free entrance is on the left of the main doors.',
    photoAlt: ['Glass entrance doors with a ramp on the left', 'The ticket desk with soft lighting', 'A wide gallery with benches along the walls'],
    fields: [{ label: 'Flashing lights' }, { label: 'Seating', value: 'Benches in every room and stools you can borrow.' }],
    steps: [
      step('Main entrance', 'Wide glass doors open onto a bright, high-ceilinged lobby. The doors are automatic and there is a step-free ramp on the left.', 'Staff in blue jackets will help with doors or questions.', 'Walk straight ahead to the ticket desk.'),
      step('Ticket desk and cloakroom', 'A staffed desk where tickets are checked and coats and bags can be left. A soft chime sounds each time the entrance door opens.', 'Ask for the quiet-hours map; it shows the calmest route.', 'Take the lift or the wide stairs to the first floor.'),
      step('Permanent gallery', 'Large, evenly lit rooms with paintings from the 19th and 20th centuries. There is seating every few metres. The floors are wooden and footsteps can echo.', 'Audio guides are optional. Headphones are available if the rooms feel noisy.', 'Follow the green line on the floor to the contemporary hall.'),
      step('Contemporary hall', 'A darker hall with three video works. Some screens flash, and one installation plays loud sound for about five minutes every hour.', 'A sign at the door says when the loud installation plays.', 'A side door leads to the family workshop room.'),
      step('Family workshop room', 'A busy, colourful room for drawing and making things. School groups use it on weekday mornings.', 'Afternoons are calmer.', 'The quiet room is across the corridor.'),
      step('Quiet room', 'A small room with dimmed light, soft seating and no screens. Phones are on silent. You can stay as long as you like.', 'Headphones and a weighted blanket can be borrowed from the ticket desk.', 'Go down to the café on the ground floor.'),
      step('Café', 'A café with a short menu and a terrace. The coffee machines and cutlery are noisy at lunch time.', 'Allergens are listed on the counter.', 'The shop is next to the exit.'),
      step('Shop and exit', 'A small shop with postcards and books next to the exit doors. The light is warm and no music is played.', 'A side door lets you leave without passing through the shop.', 'Thank you for visiting.'),
    ],
  },
  ro: {
    name: 'Muzeul de Artă Vizuală Cluj (fictiv)', address: 'Strada Muzeului 12',
    description: 'Un muzeu de pictură din secolele XIX și XX și de artă video contemporană, pe patru niveluri ale unei foste clădiri bancare.',
    arrivalInfo: 'Tramvaiele 101 și 102 opresc la 80 de metri de ușă. Intrarea fără trepte este în stânga ușilor principale.',
    photoAlt: ['Uși de sticlă la intrare, cu o rampă în stânga', 'Biroul de bilete, cu lumină blândă', 'O galerie largă, cu bănci de-a lungul pereților'],
    fields: [{ label: 'Lumini intermitente' }, { label: 'Locuri de stat', value: 'Bănci în fiecare sală și scaune pliante pe care le puteți împrumuta.' }],
    steps: [
      step('Intrarea principală', 'Uși largi de sticlă se deschid într-un hol luminos, cu tavan înalt. Ușile sunt automate, iar în stânga există o rampă fără trepte.', 'Personalul în veste albastre vă ajută cu ușile sau cu întrebările.', 'Mergeți drept înainte până la biroul de bilete.'),
      step('Biroul de bilete și garderoba', 'Un birou cu personal unde se verifică biletele și se pot lăsa haine și genți. Un clinchet scurt se aude de fiecare dată când se deschide ușa de la intrare.', 'Cereți harta orelor liniștite; arată cel mai calm traseu.', 'Luați liftul sau scările late până la primul etaj.'),
      step('Galeria permanentă', 'Săli mari, luminate uniform, cu picturi din secolele XIX și XX. Găsiți locuri de stat la câțiva metri. Podelele sunt din lemn și pașii pot răsuna.', 'Ghidurile audio sunt opționale. Aveți la dispoziție căști dacă sălile vi se par zgomotoase.', 'Urmați linia verde de pe podea până în sala contemporană.'),
      step('Sala contemporană', 'O sală mai întunecată, cu trei lucrări video. Unele ecrane clipesc, iar o instalație redă sunet puternic circa cinci minute în fiecare oră.', 'Un panou de la ușă arată când rulează instalația cu sunet puternic.', 'O ușă laterală duce la sala de ateliere pentru familii.'),
      step('Sala de ateliere pentru familii', 'O sală animată și colorată, pentru desen și lucru manual. Grupurile școlare o folosesc în dimineața zilelor lucrătoare.', 'După-amiezile sunt mai liniștite.', 'Camera liniștită este peste coridor.'),
      step('Camera liniștită', 'O cameră mică, cu lumină slabă, fotolii moi și fără ecrane. Telefoanele sunt pe silențios. Puteți rămâne cât doriți.', 'Căști și o pătură grea se pot împrumuta de la biroul de bilete.', 'Coborâți la cafenea, la parter.'),
      step('Cafeneaua', 'O cafenea cu un meniu scurt și o terasă. Aparatele de cafea și tacâmurile fac zgomot la prânz.', 'Alergenii sunt afișați la tejghea.', 'Magazinul este lângă ieșire.'),
      step('Magazinul și ieșirea', 'Un magazin mic, cu cărți poștale și cărți, lângă ușile de ieșire. Lumina este caldă și nu se difuzează muzică.', 'O ușă laterală vă permite să ieșiți fără să treceți prin magazin.', 'Vă mulțumim pentru vizită.'),
    ],
  },
  de: {
    name: 'Museum für Visuelle Kunst Cluj (fiktiv)', address: 'Strada Muzeului 12',
    description: 'Ein Museum für Malerei des 19. und 20. Jahrhunderts und zeitgenössische Videokunst, auf vier Etagen eines ehemaligen Bankgebäudes.',
    arrivalInfo: 'Die Straßenbahnlinien 101 und 102 halten 80 Meter vom Eingang entfernt. Der stufenlose Zugang liegt links neben den Haupttüren.',
    photoAlt: ['Gläserne Eingangstüren mit einer Rampe links', 'Der Kartenschalter mit weichem Licht', 'Eine weite Galerie mit Bänken an den Wänden'],
    fields: [{ label: 'Blitzende Lichter' }, { label: 'Sitzgelegenheiten', value: 'Bänke in jedem Raum und Klapphocker zum Ausleihen.' }],
    steps: [
      step('Haupteingang', 'Breite Glastüren öffnen sich in eine helle Eingangshalle mit hoher Decke. Die Türen sind automatisch, links gibt es eine stufenlose Rampe.', 'Mitarbeitende in blauen Jacken helfen bei den Türen und beantworten Fragen.', 'Gehen Sie geradeaus bis zum Kartenschalter.'),
      step('Kartenschalter und Garderobe', 'Ein besetzter Schalter, an dem Karten kontrolliert werden und Mäntel und Taschen abgegeben werden können. Ein leiser Gong ertönt, wenn die Eingangstür aufgeht.', 'Fragen Sie nach dem Plan für ruhige Zeiten; er zeigt den ruhigsten Weg.', 'Nehmen Sie den Aufzug oder die breite Treppe in den ersten Stock.'),
      step('Ständige Sammlung', 'Große, gleichmäßig beleuchtete Räume mit Gemälden des 19. und 20. Jahrhunderts. Alle paar Meter gibt es Sitzgelegenheiten. Die Böden sind aus Holz, Schritte können hallen.', 'Audioguides sind freiwillig. Kopfhörer gibt es, wenn Ihnen die Räume zu laut sind.', 'Folgen Sie der grünen Linie am Boden zur Halle für zeitgenössische Kunst.'),
      step('Halle für zeitgenössische Kunst', 'Eine dunklere Halle mit drei Videoarbeiten. Einige Bildschirme blitzen, und eine Installation spielt jede Stunde etwa fünf Minuten lang laut.', 'Ein Schild an der Tür zeigt, wann die laute Installation läuft.', 'Eine Seitentür führt zum Familienatelier.'),
      step('Familienatelier', 'Ein lebhafter, bunter Raum zum Zeichnen und Basteln. Schulklassen nutzen ihn an Werktagsvormittagen.', 'Nachmittags ist es ruhiger.', 'Der Ruheraum liegt auf der anderen Seite des Flurs.'),
      step('Ruheraum', 'Ein kleiner Raum mit gedämpftem Licht, weichen Sitzen und ohne Bildschirme. Handys sind lautlos gestellt. Sie können so lange bleiben, wie Sie möchten.', 'Kopfhörer und eine Gewichtsdecke gibt es am Kartenschalter.', 'Gehen Sie hinunter zum Café im Erdgeschoss.'),
      step('Café', 'Ein Café mit kleiner Karte und Terrasse. Kaffeemaschinen und Besteck sind mittags laut.', 'Allergene stehen an der Theke.', 'Der Shop liegt neben dem Ausgang.'),
      step('Shop und Ausgang', 'Ein kleiner Shop mit Postkarten und Büchern neben den Ausgangstüren. Das Licht ist warm, es läuft keine Musik.', 'Durch eine Seitentür können Sie hinausgehen, ohne den Shop zu durchqueren.', 'Danke für Ihren Besuch.'),
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Kunsthaus am Fluss: a small German-only museum, three steps, one photo.
// ---------------------------------------------------------------------------------------------------------------------
export const kunsthaus = {
  type: 'museum', city: 'Passau', country: 'DE',
  zones: [
    { type: 'entrance', photo: true, sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'low') },
    { type: 'collection', sensory: levels('low', 'moderate', 'low', 'low', 'low', 'moderate') },
    { type: 'quiet-room', sensory: levels('low', 'low', 'low', 'low', 'moderate', 'low') },
  ],
  de: {
    name: 'Kunsthaus am Fluss (fiktiv)', address: 'Innpromenade 4',
    description: 'Ein kleines Haus für Gegenwartskunst direkt am Ufer, mit wechselnden Ausstellungen auf zwei Etagen.',
    arrivalInfo: 'Vom Hauptbahnhof sind es 12 Minuten zu Fuß, der Weg ist eben. Behindertenparkplätze gibt es vor dem Haus.',
    photoAlt: ['Der Eingang des Kunsthauses mit einer niedrigen Schwelle'],
    steps: [
      step('Eingang', 'Eine schwere Glastür mit Türöffner-Knopf. Drinnen ist es hell und ruhig, es riecht leicht nach Holz.', 'Die Schwelle ist drei Zentimeter hoch; eine Rampe liegt bereit.', 'Der Empfang ist gleich rechts.'),
      step('Ausstellung', 'Zwei große Räume mit jeweils einer Ausstellung. Die Beleuchtung ist gleichmäßig. Es gibt keine Tonwerke.', 'Die Texte hängen in Augenhöhe und sind in großer Schrift gedruckt.', 'Eine Treppe und ein Aufzug führen zum Ruheraum.'),
      step('Ruheraum', 'Ein kleiner Raum mit Blick auf den Fluss, zwei Sesseln und gedämpftem Licht. Kein Bildschirm, kein Ton.', 'Der Raum ist immer frei und muss nicht angemeldet werden.', 'Der Ausgang liegt im Erdgeschoss.'),
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Hotel Lindenhof: English and Romanian complete; German started with only two steps, so it waits.
// ---------------------------------------------------------------------------------------------------------------------
export const hotel = {
  type: 'hotel', city: 'Sibiu', country: 'RO',
  zones: [
    { type: 'entrance', sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'low') },
    { type: 'reception', sensory: levels('moderate', 'moderate', 'variable', 'low', 'moderate', 'low') },
    { type: 'room', sensory: levels('low', 'low', 'low', 'low', 'moderate', 'low') },
    { type: 'breakfast', sensory: levels('high', 'moderate', 'high', 'high', 'moderate', 'moderate') },
  ],
  en: {
    name: 'Hotel Lindenhof Sibiu (fictional)', address: 'Piața Mică 7',
    description: 'A family-run hotel with 24 rooms in a renovated townhouse on the old market square.',
    arrivalInfo: 'The square is cobbled and traffic-free. Taxis can stop at the corner, 40 metres from the door.',
    steps: [
      step('Arrival', 'A narrow door with a small step, opening onto a quiet hall with a wooden floor. A bell rings softly when someone comes in.', 'Call 0269 000 000 and we will meet you at the door with a ramp.', 'The reception desk is on the left.'),
      step('Reception', 'A small desk with one or two staff. Check-in takes about five minutes and you can sit down while you wait.', 'We can send the room key and instructions by message so you can skip the desk.', 'The lift is behind the stairs; it fits one wheelchair.'),
      step('A standard room', 'Quiet rooms facing the courtyard, with dimmable lights and blackout curtains. The corridor floors are carpeted.', 'Fragrance-free rooms can be requested when booking.', 'Breakfast is served on the ground floor from 7:30.'),
      step('Breakfast room', 'A bright room with eight tables. It is busiest between 8:30 and 9:30; before 8:00 it is almost empty.', 'A quiet corner table can be reserved the evening before.', 'Thank you for staying with us.'),
    ],
  },
  ro: {
    name: 'Hotel Lindenhof Sibiu (fictiv)', address: 'Piața Mică 7',
    description: 'Un hotel de familie cu 24 de camere într-o clădire renovată, pe piața veche.',
    arrivalInfo: 'Piața este pavată cu piatră și fără trafic. Taxiurile pot opri la colț, la 40 de metri de ușă.',
    steps: [
      step('Sosirea', 'O ușă îngustă, cu o treaptă mică, care dă într-un hol liniștit cu podea de lemn. Un clopoțel sună încet când intră cineva.', 'Sunați la 0269 000 000 și vă așteptăm la ușă cu o rampă.', 'Recepția este în stânga.'),
      step('Recepția', 'Un birou mic, cu unul sau doi angajați. Cazarea durează circa cinci minute și puteți sta jos cât așteptați.', 'Vă putem trimite cheia și instrucțiunile prin mesaj, ca să nu mai treceți pe la recepție.', 'Liftul este în spatele scărilor; încape un scaun cu rotile.'),
      step('O cameră standard', 'Camere liniștite, spre curtea interioară, cu lumini reglabile și draperii opace. Pe coridoare este mochetă.', 'Camerele fără parfumuri se pot cere la rezervare.', 'Micul dejun se servește la parter de la 7:30.'),
      step('Sala de mic dejun', 'O sală luminoasă, cu opt mese. Este cel mai aglomerată între 8:30 și 9:30; înainte de 8:00 este aproape goală.', 'Putem rezerva o masă într-un colț liniștit în seara dinainte.', 'Vă mulțumim că ați ales să stați la noi.'),
    ],
  },
  de: {
    name: 'Hotel Lindenhof Hermannstadt (fiktiv)', address: 'Piața Mică 7',
    description: 'Ein familiengeführtes Hotel mit 24 Zimmern in einem renovierten Bürgerhaus am alten Marktplatz.',
    arrivalInfo: 'Der Platz ist gepflastert und autofrei.',
    steps: [
      step('Ankunft', 'Eine schmale Tür mit einer kleinen Stufe, dahinter eine ruhige Halle mit Holzboden.', 'Rufen Sie 0269 000 000 an, wir erwarten Sie mit einer Rampe an der Tür.', 'Die Rezeption ist links.'),
      step('Rezeption', 'Ein kleiner Tresen mit ein bis zwei Mitarbeitenden.', 'Wir senden Ihnen den Zimmerschlüssel und die Hinweise gern vorab.', 'Der Aufzug steht hinter der Treppe.'),
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Small English places that exist to be in a particular state.
// ---------------------------------------------------------------------------------------------------------------------
const threeSteps = (a, b, c, levelsA = levels('moderate', 'moderate', 'low', 'low', 'moderate', 'low')) => ({
  zones: [
    { type: 'entrance', sensory: levelsA },
    { type: 'collection', sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'moderate') },
    { type: 'quiet-room', sensory: levels('low', 'low', 'low', 'low', 'moderate', 'low') },
  ],
  steps: [step(...a), step(...b), step(...c)],
});

// A name that begins "Place": the address that is generated from it must still be one a visitor can open.
export const placeDesArts = {
  type: 'cultural', city: 'Montréal', country: 'CA', ...threeSteps(
    ['Street entrance', 'Revolving doors on the street and a wide step-free door beside them. The foyer is tall and echoes.', 'Use the step-free door on the right.', 'The ticket hall is straight ahead.'],
    ['Concert hall foyer', 'A glass foyer with a café bar. Before and after a concert it is crowded and loud for about 20 minutes.', 'Arrive 45 minutes early for the calmest entry.', 'Ushers will show you to your seat.'],
    ['Quiet seating area', 'A small lounge on the second floor with low light, and no music or announcements.', 'Open every evening one hour before the show.', 'Stairs and a lift lead back down.']),
  en: {
    name: 'Place des Arts Society (fictional)', address: '175 Rue Sainte-Catherine Ouest',
    description: 'A performing arts venue with three halls, run by a non-profit society.',
    arrivalInfo: 'Metro: Place-des-Arts, with a direct underground entrance. Step-free throughout.',
  },
};

// A name at the length limit, with letters from three languages, symbols and a mark. It stays a draft.
export const longName = {
  type: 'museum', city: 'Iași', country: 'RO', ...threeSteps(
    ['Entrance', 'A heavy wooden door in a stone arch.', 'Staff will hold the door open.', 'Go left to the first room.'],
    ['Main room', 'One large room with glass cases.', 'Large-print labels are available.', 'The next room is down two steps; a ramp is on the right.'],
    ['Courtyard', 'A quiet courtyard with benches.', 'Open when it is dry.', 'Thank you for visiting.']),
  en: {
    name: 'Muzeul Național „Ștefan cel Mare” & Söhne — Größe Straße ✓ Collection of Curious Sensory Experiences and Everything Else (fictional)',
    address: 'Strada Ștefan cel Mare 1',
    description: 'A museum with a name that is deliberately long, to see where a heading breaks.',
    arrivalInfo: 'Bus 9 stops outside.',
  },
};

// A location the organisation has only started: one step, so it can't be published yet.
export const pavilion = {
  type: 'institution', city: 'Cluj-Napoca', country: 'RO',
  zones: [{ type: 'entrance', sensory: levels('low', 'moderate', 'low', 'low', 'moderate', 'low') }],
  steps: [step('Lake pavilion', 'A small wooden pavilion by the lake.', '', 'Follow the path.')],
  en: { name: 'Pavilion by the Lake (fictional)', address: 'Parcul Central', description: 'Work in progress.', arrivalInfo: '' },
};

// Published, then the organisation was suspended: its guide and QR code must say "unavailable".
export const harbour = {
  type: 'museum', city: 'Constanța', country: 'RO', ...threeSteps(
    ['Quayside entrance', 'A glass door on the quay, with wind noise outside.', 'The door is heavy; press the side button.', 'The ship models are on the left.'],
    ['Ship models', 'A hall of ship models in glass cases, lit from above.', 'Some cases hum softly.', 'The lighthouse room is at the end.'],
    ['Lighthouse room', 'A small dark room with a rotating light, which sweeps the walls every ten seconds.', 'Tell the guide if you prefer not to enter.', 'Stairs lead back to the quay.']),
  en: { name: 'Harbour Lights Museum (fictional)', address: 'Faleza 3', description: 'A maritime museum on the quay.', arrivalInfo: 'Buses 40 and 43.' },
};

// Published, then taken down by its owner: the QR code stays and says "unavailable".
export const railway = {
  type: 'museum', city: 'Brașov', country: 'RO', ...threeSteps(
    ['Station hall', 'The old station hall, with high windows and pigeons in the roof.', 'Whistles are played only on weekends.', 'The locomotives are outside on the platform.'],
    ['Locomotive shed', 'A shed with four locomotives. Metal floors and echoing sound.', 'Hearing protection is available.', 'The signal cabin is up the steps.'],
    ['Signal cabin', 'A small cabin reached by 14 steps, with a view of the tracks.', 'A video tour is available at the desk.', 'Return the same way.']),
  en: { name: 'Old Railway Museum (fictional)', address: 'Piața Gării 1', description: 'Locomotives and signals of the narrow-gauge line.', arrivalInfo: 'Five minutes from the station.' },
};

// Published, then edited: the live version stays until the organisation publishes again.
export const mill = {
  type: 'museum', city: 'Sighișoara', country: 'RO', ...threeSteps(
    ['Mill entrance', 'A low stone doorway on the river side.', 'Mind your head; the lintel is 1.7 metres high.', 'Go left to the mill floor.'],
    ['Mill floor', 'The working mill. When the wheel turns it is loud, and the building shakes slightly.', 'The wheel runs 10:00 to 12:00 only.', 'The granary is above.'],
    ['Granary', 'A bright loft with exhibits about bread. Quiet and warm.', 'Reached by 22 steps; there is no lift.', 'Thank you for visiting.']),
  en: { name: 'Riverside Mill Museum (fictional)', address: 'Strada Morii 2', description: 'A working water mill.', arrivalInfo: 'Ten minutes from the old town.' },
  editedFirstStep: 'Mill entrance (now with a ramp)',
};

// ---------------------------------------------------------------------------------------------------------------------
// Seven more published places in five countries and every kind of place, so the Explore filters have something to filter.
// Two share a city (Montréal) and two share a country (Germany, Austria), so narrowing by country changes the cities offered.
// ---------------------------------------------------------------------------------------------------------------------
const venue = (type, city, country, name, address, description, arrivalInfo, a, b, c) => ({
  type, city, country, ...threeSteps(a, b, c),
  en: { name: `${name} (fictional)`, address, description, arrivalInfo },
});
export const showcase = [
  ['vienna-coffee', venue('museum', 'Wien', 'AT', 'Coffeehouse Museum Vienna', 'Musterstraße 4', 'A museum about the Viennese coffeehouse.', 'Tram 2, stop Musterplatz.',
    ['Entrance', 'A revolving door and, beside it, a wide automatic door. The hall smells of roasted coffee.', 'Use the automatic door.', 'The ticket desk is on the left.'],
    ['Coffeehouse room', 'A reconstructed coffeehouse with marble tables. Cups clink and a machine hisses now and then.', 'Seats are available along the wall.', 'The quiet corner is at the back.'],
    ['Quiet corner', 'A small alcove with a bench and soft light.', 'No sound is played here.', 'Thank you for visiting.'])],
  ['graz-hotel', venue('hotel', 'Graz', 'AT', 'Hotel Murblick', 'Uferweg 12', 'A 40-room hotel on the river.', 'Five minutes on foot from the tram stop.',
    ['Arrival', 'A glass door with a ramp. The lobby is bright and has a lift.', 'Staff come to the door on request.', 'Reception is straight ahead.'],
    ['Reception', 'A long desk with a bench. Check-in takes about five minutes.', 'Online check-in is possible.', 'Rooms are reached by lift.'],
    ['A standard room', 'A quiet room facing the river, with dimmable lights.', 'Rooms without scented cleaning can be requested.', 'Breakfast is on the ground floor.'])],
  ['leipzig-office', venue('public_service', 'Leipzig', 'DE', 'Citizens’ Office Leipzig Centre', 'Marktplatz 1', 'The city office for registrations and documents.', 'Tram stop Markt, step-free.',
    ['Entrance', 'A heavy glass door with a button to open it. A guard greets you.', 'Press the blue button on the left.', 'Take a number at the machine.'],
    ['Waiting hall', 'A large hall with 60 seats and a screen that calls numbers with a loud tone.', 'Mornings are the busiest; after 14:00 it is calm.', 'Counters are along the right wall.'],
    ['Counter', 'A small desk behind a glass screen. A loop for hearing aids is installed.', 'You can ask for slower speech or written answers.', 'Thank you for your visit.'])],
  ['berlin-concerts', venue('cultural', 'Berlin', 'DE', 'Canal Concert House Berlin', 'Kanalweg 9', 'A concert house for chamber music.', 'U-Bahn Kanalstraße, with a lift.',
    ['Foyer', 'A tall foyer with a cloakroom and a café. It echoes before concerts.', 'Arrive 30 minutes early for a calm entry.', 'The hall doors are on the left.'],
    ['Concert hall', 'A hall with 400 seats and warm lighting. Sound is loud during the finale.', 'Ear plugs are free at the cloakroom.', 'Ushers will guide you to your seat.'],
    ['Quiet room', 'A small room with a speaker that carries the concert at low volume.', 'Open during every concert.', 'Return to the foyer by the stairs or lift.'])],
  ['timisoara-library', venue('institution', 'Timișoara', 'RO', 'Timișoara University Library', 'Bulevardul Vasile Pârvan 4', 'A university library open to the public.', 'Tram 9, stop Universitate.',
    ['Entrance', 'Two sets of doors, the second with a security gate that beeps.', 'Tell the guard if you need to avoid the gate.', 'The reading room is upstairs.'],
    ['Reading room', 'A long room with desks and green lamps. It is silent and slightly cold.', 'Bring a jumper; it is 19 degrees.', 'Quiet booths are at the end.'],
    ['Quiet booth', 'A booth with a door, a chair and a lamp that you can switch off.', 'Book at the desk for up to two hours.', 'Thank you for visiting.'])],
  ['montreal-trams', venue('museum', 'Montréal', 'CA', 'Tram Museum Montréal', '110 Rue Saint-Pierre', 'Historic trams from 1890 to 1959.', 'Bus 55, stop Saint-Pierre.',
    ['Entrance', 'A wide doorway into the old depot. Metal floors and a faint smell of oil.', 'Wheelchairs can enter by the side ramp.', 'The tram hall is straight ahead.'],
    ['Tram hall', 'Eight trams in a bright hall. A bell rings twice an hour.', 'Benches are placed between the trams.', 'The workshop is at the back.'],
    ['Workshop', 'A noisy workshop with demonstrations at 11:00 and 15:00.', 'Skip it if sound is hard; the demonstrations can be watched through a window.', 'Return to the entrance.'])],
  ['zurich-baths', venue('other', 'Zürich', 'CH', 'Lakeside Baths Zürich', 'Seestrasse 20', 'A public swimming and sauna house on the lake.', 'Tram 11, stop Seeblick.',
    ['Entrance', 'A turnstile with a card reader, and a staffed gate beside it.', 'Use the staffed gate if you cannot use the turnstile.', 'Changing rooms are on the left.'],
    ['Changing rooms', 'Open changing rooms and single cabins. Lockers close with a loud clack.', 'Single cabins are free of charge.', 'The pool hall is down a short corridor.'],
    ['Pool hall', 'A bright hall with echo and strong chlorine smell. Quiet hours are 07:00 to 09:00.', 'Lanes for slow swimmers are marked in blue.', 'Thank you for visiting.'])],
];

// ---------------------------------------------------------------------------------------------------------------------
// The people and organisations. Fictional names, and only @example.test addresses.
// ---------------------------------------------------------------------------------------------------------------------
export const people = [
  { n: 20, email: 'admin.second@example.test', note: 'Second platform administrator (reviews what the first cannot review, and has two-factor set up)' },
  { n: 21, email: 'owner.cluj@example.test', note: 'Owner of Visual Arts Museum Cluj, with two-factor set up: asks for a code' },
  { n: 22, email: 'owner.kunsthaus@example.test', note: 'Owner of Kunsthaus am Fluss (a German-only museum)' },
  { n: 23, email: 'admin.willow@example.test', note: 'Organisation admin (not owner) of the Willow Museum' },
  { n: 24, email: 'owner.hotel@example.test', note: 'Owner of Hotel Lindenhof, with a German guide that is too short to publish' },
  { n: 25, email: 'owner.arts@example.test', note: 'Owner of Place des Arts Society: a "Place…" address, a very long name, a draft, a guide edited after publishing' },
  { n: 26, email: 'owner.harbour@example.test', note: 'Owner of a SUSPENDED organisation (signed in, sees no data; its guide shows "unavailable")' },
  { n: 27, email: 'owner.railway@example.test', note: 'Owner of a museum that took its guide down (QR code says "unavailable")' },
  { n: 28, email: 'applicant.needsinfo@example.test', note: 'Applicant asked for more information' },
  { n: 29, email: 'applicant.rejected@example.test', note: 'Applicant whose request was rejected' },
  { n: 30, email: 'unconfirmed@example.test', note: 'Registered but never confirmed the email (cannot sign in)', confirmed: false },
  { n: 32, email: 'owner.showcase@example.test', note: 'Owner of seven published places in five countries (for trying the Explore filters)' },
  { n: 31, email: 'owner.large@example.test', note: 'Owner of 55 organisations and 100+ places (only with the volume option)', volume: true },
];
