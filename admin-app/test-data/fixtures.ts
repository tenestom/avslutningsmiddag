export interface TestParticipantAnswer {
  question_number: number;
  question_text: string;
  answer_text: string;
}

export interface TestParticipant {
  name: string;
  answers: TestParticipantAnswer[];
}

const QUESTIONS = [
  'Vad var det roligaste eller mest minnesvärda som hände under kursen?',
  'Beskriv det största hotet mot vår säkerhet.',
  'Om du fick bestämma en enda sak Sverige ska satsa på för att stärka totalförsvaret, vad skulle det vara?',
  'Vad tycker du är viktigast att göra redan imorgon, innan något annat?',
  'Vad vill du tacka kursen/arrangören för?',
];

function answers(a1: string, a2: string, a3: string, a4: string, a5: string): TestParticipantAnswer[] {
  return [
    { question_number: 1, question_text: QUESTIONS[0], answer_text: a1 },
    { question_number: 2, question_text: QUESTIONS[1], answer_text: a2 },
    { question_number: 3, question_text: QUESTIONS[2], answer_text: a3 },
    { question_number: 4, question_text: QUESTIONS[3], answer_text: a4 },
    { question_number: 5, question_text: QUESTIONS[4], answer_text: a5 },
  ];
}

export const TEST_PARTICIPANTS: TestParticipant[] = [
  {
    name: 'Erik Lindström',
    answers: answers(
      'Strömövningen på torsdagskvällen när hela byggnaden faktiskt slocknade och vi satt med pannlampor och åt smörgåsar. Perfekt timing, eller planerat? Vi vet fortfarande inte.',
      'Vår totala tillit till att internet alltid finns. Vi har byggt hela samhället på ett enda lager som kan slås ut av en grävmaskin i fel stad.',
      'Bygga ut robusta fibernät med fysiska redundanta system – och sluta tro att molnet är ett säkert alternativ när infrastrukturen brinner.',
      'Ringa min IT-chef och faktiskt fråga vad som händer med verksamheten om vi förlorar internetanslutningen i 72 timmar.',
      'För att ha gett mig verktyg att faktiskt göra något åt oron istället för att bara känna den. Och för kaffet – det var oväntat bra.',
    ),
  },
  {
    name: 'Sara Björk',
    answers: answers(
      'Gruppdiskussionen om vem som skulle ta ansvar för vad i en kris. Det tog exakt tio minuter innan vi insåg att svaret var "ingen har koll". Befriande ärlighet.',
      'Desinformation som sprids snabbare än vi kan korrigera den, kombinerat med en befolkning som inte övar källkritik.',
      'Obligatorisk medieberedskapsutbildning i grundskolan. Börja med barnen – de vuxna är förlorade fall.',
      'Gå igenom kommunens krisinformation och faktiskt kontrollera om länkarna fungerar. Spoiler: de gör det troligen inte.',
      'För att ni vågade säga det ingen annan vill höra: vi är inte förberedda. Det behövde sägas.',
    ),
  },
  {
    name: 'Magnus Carlsson',
    answers: answers(
      'Roleplaying-scenariot där vi simulerade ett pressmeddelande under kris. Min grupp lyckades göra det ännu mer förvirrande än originalet. Vi har talang.',
      'Hybridkrigföring – kombinationen av cyberattacker, ekonomisk påtryckning och informationspåverkan som ingen enskild myndighet äger helheten av.',
      'Att inrätta ett nationellt krisledningscenter som faktiskt har mandat att fatta beslut tvärs över myndighetsgränser.',
      'Kolla upp om min arbetsplats har en kontinuitetsplan och om den senast uppdaterades under 2000-talet.',
      'För de utmärkta föreläsarna som klarade av att hålla oss engagerade även efter lunch. Det är en konst.',
    ),
  },
  {
    name: 'Lena Gustafsson',
    answers: answers(
      'Middagen på dag två. Inte för att den var extraordinär, utan för att vi äntligen vågade skratta åt hur absurd situationen är – och det var skönt.',
      'Att vi i Sverige fortfarande beter oss som om fred är standardläget och krig är ett undantag. Det omvända är historiens norm.',
      'Folkförankring. Investera i att varje medborgare förstår sin roll – inte militärt, utan civilt. Grannen är din första försvarslinje.',
      'Köpa hem ett nödlager. Inte för att jag tror på apokalypsen, utan för att tre dagars mat och vatten är en rimlig lägstanivå av vuxenhet.',
      'För att ha skapat ett rum där frågorna fick vara svåra och svaren fick vara osäkra. Det är sällsynt.',
    ),
  },
  {
    name: 'Johan Nilsson',
    answers: answers(
      'Övningen när vi fick 30 minuter på oss att hitta alla sårbarheter i ett fiktivt kommunalt nätverk. Vi hittade tolv. Det är inte fiktivt, berättade föreläsaren sedan.',
      'Kompetensutflöde. Vi utbildar cybersäkerhetsexperter och de går direkt till privata bolag med tre gånger lönen. Offentlig sektor blöder.',
      'Kraftigt höja lönerna för kritisk kompetens inom offentlig sektor. Annars spelar resten ingen roll.',
      'Inventera vilken kompetens som faktiskt finns på min arbetsplats och vad som händer om nyckelpersoner inte kan nå kontoret.',
      'För nätverket. Jag åkte ensam och åker hem med tolv nya kollegor som jag litar på.',
    ),
  },
  {
    name: 'Anna Persson',
    answers: answers(
      'Kvällspasset med fri diskussion. Folk sa saker de aldrig säger på jobbet. Det var en påminnelse om varför vi egentligen behöver sådana här kurser.',
      'Klimatförändringar som förstärkare av alla andra hot – torka, migration, energikris. Det är inte ett separat problem, det är multiplikatorn.',
      'Grön energiomställning i kombination med energilagring. Energioberoende är försvarsförmåga.',
      'Prata med min chef om vad vi faktiskt gör om kontoret inte går att använda i en vecka. Vi har inte den konversationen haft.',
      'För att ha kopplat ihop mig med så många engagerade och kunniga människor. Det är ett ovärderligt kapital.',
    ),
  },
  {
    name: 'Peter Holm',
    answers: answers(
      'Föreläsaren som stannande kvar till midnatt för att diskutera kartor. Det var antingen passion eller koffeinmissbruk – båda är respektabla.',
      'Naivitet som systemegenskap. Vi bygger system utan att räkna med att de kan angripas, och kallar det effektivitet.',
      'Krav på redundans i all kritisk infrastruktur. Om systemet inte fungerar utan internet är det inte ett godkänt system.',
      'Uppdatera min organisations katastrofplan – och faktiskt läsa den den här gången, inte bara skriva under.',
      'För att ha gett mig en ny syn på vad "ansvar" faktiskt innebär. Det är inte andras ansvar. Det är mitt.',
    ),
  },
  {
    name: 'Maja Svensson',
    answers: answers(
      'Att vi diskuterade civila dödsfall i nutida europeiska konflikter klockan nio på morgonen med kaffe i handen. Det var en surrealistisk kombination som ändå gav effekt.',
      'Den polariserade samhällsdebatten. Ett land som inte kan enas om verklighetsbeskrivningen är extremt sårbart för informationsoperationer.',
      'Investera massivt i public service och mediefrihet. Det är vår viktigaste psykologiska försvarsinfrastruktur.',
      'Läsa de senaste MSB-rapporterna som jag systematiskt har ignorerat sedan de kom. Skamfylld men motiverad.',
      'För den ärlighet och värme som präglade hela kursen. Man lärs inte så mycket som man törs lära.',
    ),
  },
  {
    name: 'Thomas Eriksson',
    answers: answers(
      'Gruppövningen om evakuering. Vi spenderade tjugo minuter på att argumentera om vem som skulle bära kartan. Kartan var digital och batteriet var slut.',
      'El- och vattenförsörjning. Vi är en infrastrukturkollaps bort från kaos, och ingen vill betala för reservkraft i fredstid.',
      'Reservkraft till alla sjukhus, vattenverk och kritiska datacenter – inte om tio år, nu.',
      'Hitta var närmaste uppsamlingsplats i kommunen är och faktiskt förklara det för familjen.',
      'För att ni på allvar behandlade oss som vuxna som kan hantera obehagliga sanningar. Det är mer ovanligt än det borde vara.',
    ),
  },
  {
    name: 'Karin Johansson',
    answers: answers(
      'Diskussionen om psykologiskt försvar. Det var första gången jag hörde någon säga "vi behöver lära oss att vara rädda på rätt sätt" och menade det som en strategi, inte en svaghet.',
      'Ensamhet och brist på gemenskap. Det är vår allra svagaste länk – ett fragmenterat samhälle motstår inte påfrestning.',
      'Grannskapsstrukturer och civilsamhällets organisationsförmåga. IKEA-modellen: enkla instruktioner, lokalt utförande, bred täckning.',
      'Ta kontakt med min bostadsrättsförening och föreslå en grannkontaktslista. Låg tröskel, hög effekt.',
      'För att ha gett mig konkreta verktyg och inte bara en lista med hot. Det är skillnaden mellan beredskap och ångest.',
    ),
  },
  {
    name: 'Fredrik Larsson',
    answers: answers(
      'Riskbedömningsövningen. Min grupp kom fram till att vår verksamhets största sårbarhet var kaffemaskinen. Vi vidhåller det.',
      'Supply chain-beroenden vi inte ens känner till. Vi importerar 95% av vår elektronik från länder vi inte kan lita på i ett krisläge.',
      'Kartlägga och delvis repatriera kritisk tillverkning – framför allt medicin, batterier och halvledare.',
      'Faktiskt kolla upp vilka myndigheter jag ska kontakta vid olika typer av incidenter. Spoiler: det är inte ett nummer.',
      'För att ni lyckades kombinera allvar och humor på ett sätt som inte trivialiserade ämnet. Det är svårt gjort.',
    ),
  },
  {
    name: 'Ingrid Andersson',
    answers: answers(
      'Föreläsningen om psykologisk påverkan. Att inse att man själv är en måltavla är ett ganska effektivt sätt att börja ta det på allvar.',
      'Oss själva. Vår ovilja att prioritera långsiktiga hot framför kortsiktiga bekvämligheter är det som gör alla andra hot möjliga.',
      'Sluta skjuta upp beslut om totalförsvaret. Det kostar mer att vänta än att agera – varje år.',
      'Ringa kommunen och fråga om de har en lista på reserv-möteplatser. Jag är beredd på att svaret är nej.',
      'För att ha visat att krismedvetenhet kan vara en gemensamhetsupplevelse och inte en isolerad skräckupplevelse.',
    ),
  },
  {
    name: 'Robert Håkansson',
    answers: answers(
      'Övningen med analogt beslutsfattande – ingen telefon, papper och penna, tidspress. Jag fattade tre bra beslut och glömde helt bort att kolla LinkedIn. 10/10.',
      'Beslutströghet. I en akut situation måste beslut fattas på minuter, inte månader. Vår politiska och administrativa kultur är inte byggd för det.',
      'Öva krishantering på riktigt – simuleringar, faktiska beslutsscenarion, upplevda konsekvenser. Inte rapporter. Övningar.',
      'Prata med min familj om vad vi gör om något händer och vi inte kan nå varandra. Den konversationen är obekväm och nödvändig.',
      'För att ha väckt mig utan att larma mig. Det är en konstform.',
    ),
  },
  {
    name: 'Helena Lindqvist',
    answers: answers(
      'Gruppchefsövningen. Vi valdes slumpmässigt och det visade sig att den tystaste personen i gruppen hade de bästa instinkterna. Ledarskapslärdomen satt.',
      'Extremt väder kombinerat med otillräcklig infrastruktur. Klimatpåverkan är inte en framtidsfråga – det händer nu och vi är inte redo.',
      'Klimatanpassa kritisk infrastruktur – inte som ett framtidsprojekt utan som ett akut renoveringsprogram.',
      'Kolla om min kommuns beredskapsplan är offentlig och faktiskt läsbar. Engagerat medborgarskap börjar där.',
      'För föreläsarna som delade sina egna erfarenheter och inte bara läste från bilderna. Det är en enorm skillnad.',
    ),
  },
  {
    name: 'Anders Bergström',
    answers: answers(
      'Kaffepausen dag tre när vi stod ute i regnet och diskuterade cyberattacker. Det var metaforiskt helt perfekt och vi alla insåg det samtidigt.',
      'Kombinationen av demografisk åldrande befolkning och minskad beredskapskompetens. Vi tappar kunskapen i ett snabbare tempo än vi bygger ny.',
      'Säkerställa kunskapstransferprogrammer – att de som kan måste lära ut till de som kommer. Systematiskt, inte slumpartat.',
      'Boka in ett möte med min avdelning och faktiskt fråga vilka som har krigsplacering och vad det innebär för oss.',
      'För att ha gett totalförsvarsbegreppet ett ansikte jag kan relatera till. Det är inte abstrakt längre.',
    ),
  },
  {
    name: 'Cecilia Nordin',
    answers: answers(
      'Scenarisövningen med den fiktiva kommunen "Mellansverige". Alla förstod direkt att det var vår faktiska hemkommun med ett annat namn. Galgen humor fungerar pedagogiskt.',
      'Korruption som möjliggörs av bristande transparens och svag rättstat. Det underminerar allt annat vi försöker bygga.',
      'Stärka oberoende granskningsmyndigheter och visselblåsarskydd. Demokratins inre immunförsvar måste prioriteras.',
      'Faktiskt fylla i 1177:s beredskapssidor och se till att min familj vet var de finns. Basic, men det har inte hänt.',
      'För att ha kombinerat seriöst innehåll med äkta nyfikenhet. Det smittar av sig.',
    ),
  },
  {
    name: 'Mikael Strand',
    answers: answers(
      'Det spontana samtal som uppstod på morgondagen om Putin och paradoxer. Ingen borde behöva förklara den meningsskiljaktigheten – och ändå var det en av de bästa diskussionerna jag haft på år och dag.',
      'Ekonomisk sårbarhet – vi är för beroende av globala handelskedjor för saker vi faktiskt behöver för att överleva.',
      'Strategiska lager av livsmedel, drivmedel och mediciner på nationell nivå. Inte symboliska, utan faktiskt tillräckliga.',
      'Göra upp en lista på de tre mest kritiska sakerna min organisation inte skulle klara sig utan – och kontakta leverantörerna redan idag.',
      'För att ha visat att det är möjligt att prata om krig och kris utan att tappa humorn eller hoppet.',
    ),
  },
  {
    name: 'Susanne Ågren',
    answers: answers(
      'Nätverksbyggandet. Jag satt bredvid en kommunsäkerhetschef, en militärläkare och en lokal politiker under samma middag. Sådana oväntade kombinationer är guld.',
      'Polarisering och splittring av gemensamma sanningar. När vi inte ens kan enas om fakta är vi extremt sårbara för manipulation.',
      'Investera i samhällelig sammanhållning – integration, möten mellan grupper, lokal demokrati. Det är inte mjuka värden, det är hård säkerhetspolitik.',
      'Kontakta min kommuns säkerhetssamordnare och fråga hur jag som privatperson kan bidra till lokal beredskap.',
      'För att ha skapat ett rum för genuint utbyte. Inte föreläsning, utan samtal. Det är skillnad.',
    ),
  },
  {
    name: 'Daniel Öberg',
    answers: answers(
      'Riskmatrisövningen där vi skulle rangordna hot efter sannolikhet och konsekvens. Gruppen var komplett oenig – och det var poängen hela tiden.',
      'Obefintlig reservkompetens i kritiska funktioner. En pandemi visade hur snabbt vi tappar funktionalitet. Vi lärde oss uppenbarligen inte tillräckligt.',
      'Bygga in redundans i alla samhällskritiska system från start – dubbla system, alternativa rutiner, tränade backups.',
      'Skriva ned tre saker jag inte visste om totalförsvar för tre dagar sedan och dela dem med en kollega som inte var med.',
      'För en kurs som faktiskt förändrade hur jag tänker. Det händer sällan. Det är värt allt.',
    ),
  },
  {
    name: 'Birgitta Wallén',
    answers: answers(
      'Plötslig strömavstängning i salen – oplanerad, visade det sig. Alla reagerade automatiskt med att ta fram telefonens ficklampa. Föreläsaren sa bara: "Bra beredskap." Det var kanske planerat ändå.',
      'Bristande psykologisk motståndskraft i befolkningen. Vi är inte vana vid motgångar och långvarig osäkerhet. Det är en sårbarhet som inte syns i infrastrukturkartor.',
      'Psykologiskt försvarsarbete integrerat i skolan och arbetslivet. Förmågan att hantera kris börjar långt innan krisen.',
      'Prata med mina barn om vad de ska göra om ett larm går och de är ensamma hemma. Den konversationen kan inte vänta längre.',
      'För att ni tog oss på allvar, för att ni gav oss tid att tänka, och för att ni påminde oss om att beredskap är en kollektiv uppgift.',
    ),
  },
];
