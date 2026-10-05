/**
 * World sheet candidates (national capitals come from Natural Earth; see
 * gazetteer/lists.mjs). Chosen for UPSC mapping value: physical features in
 * the syllabus and previous papers, conservation sites, and places in recent
 * current affairs (conflicts, disputed areas, chokepoints, strategic ports).
 */
import { G } from './dsl.mjs'

export default [
  // ── Rivers ─────────────────────────────────────────────────────────────
  ...G('river', 2, 'syllabus', [
    'Ural River', 'Irtysh', 'Kolyma River', 'Oder', 'Loire', 'Tagus', 'Dniester', 'Kura (South Caucasus river)', 'Amu Darya', 'Helmand River', 'Kabul River', 'Karun River', 'Litani River',
    'Songhua River', 'Pearl River (China)', 'Red River (Asia)', 'Chindwin River', 'Brahmaputra River', 'Blue Nile', 'White Nile', 'Senegal River',
    'Volta River', 'Ubangi River', 'Orange River', 'Okavango River', 'Juba River', 'Madeira River', 'Rio Negro (Amazon)', 'Xingu River', 'Tapajós', 'São Francisco River', 'Uruguay River', 'Magdalena River',
    'Ohio River', 'Tennessee River', 'Yukon River', 'Fraser River', 'Darling River', 'Scheldt', 'Kafue River', 'Vakhsh River', 'Huangpu River', 'Tarim River', 'Ili River',
  ]),

  // ── Lakes ──────────────────────────────────────────────────────────────
  ...G('lake', 2, 'syllabus', [
    'Lake Issyk-Kul', 'Qinghai Lake', 'Lake Toba', 'Lake Biwa', 'Tonle Sap', 'Sea of Galilee', 'Lake Nasser', 'Lake Kariba', 'Lake Volta',
    'Lake Turkana', 'Lake Kivu', 'Lake Rudolf', 'Lake Nicaragua', 'Lake Maracaibo', 'Lake Geneva', 'Lake Constance',
    'Lake Ohrid', 'Great Bitter Lake', 'Lake Manzala',
    'Lake Timsah', 'Lake Okeechobee', 'Lake Taupō', 'Lake Assal (Djibouti)', 'Lake Natron', 'Lake Nakuru',
    'Lake Itasca', 'Laguna Colorada', 'Plitvice Lakes National Park', 'Boiling Lake',
  ]),

  // ── Mountains ──────────────────────────────────────────────────────────
  ...G('range', 2, 'syllabus', [
    'Karakoram', 'Hengduan Mountains', 'Verkhoyansk Range', 'Kopet Dag',
    'Sulaiman Mountains', 'Taurus Mountains', 'Scandinavian Mountains', 'Dolomites', 'Sierra Nevada (U.S.)', 'Cascade Range',
    'Alaska Range', 'Sierra Madre Occidental', 'Sierra Madre Oriental', 'Andean Volcanic Belt', 'Rwenzori Mountains',
    'Tibesti Mountains', 'Annamite Range',
    'Arakan Mountains', ]),
  ...G('peak', 2, 'syllabus', [
    'Mount Ararat', 'Mount Damavand', 'Mount Olympus', 'Matterhorn', 'Aoraki / Mount Cook', 'Mount Elgon', 'Ras Dashen', 'Mount Cameroon', 'Jebel Toubkal', 'Mount Sinai', 'Mount Hermon', 'Mount Kailash', 'Huascarán', 'Mount Roraima', 'Mount Wilhelm', 'Yushan (mountain)', 'Mount Paektu', 'Ismoil Somoni Peak',
    'Khan Tengri', 'Pik Lenin', 'Noshaq', 'K2', 'Mount Everest', 'Mount Thuillier',
  ]),
  ...G('volcano', 2, 'syllabus', [
    'Hunga Tonga–Hunga Haʻapai', 'Mount Tambora', 'Mount Agung', 'Mount Semeru', 'Mount Ruang', 'Mount Marapi', 'Mayon', 'Kanlaon',
    'Sakurajima', 'Klyuchevskaya Sopka', 'Eyjafjallajökull', 'Hekla', 'Fagradalsfjall', 'Grímsvötn', 'Mount Nyiragongo',
    'Ol Doinyo Lengai', 'Erta Ale', 'Mount Pelée', 'Soufrière Hills', 'La Soufrière (volcano)', 'Popocatépetl',
    'Nevado del Ruiz', 'Teide', 'Mount Vesuvius', 'Campi Flegrei', 'Santorini caldera', 'Yellowstone Caldera',
    'Mount Ruapehu', 'Whakaari / White Island', 'Barren Island (Andaman Islands)',
  ]),

  // ── Islands ────────────────────────────────────────────────────────────
  ...G('island', 2, 'syllabus', [
    'Luzon', 'Hainan', 'Taiwan', 'Sakhalin', 'Jeju Island', 'Andaman Islands', 'Zanzibar', 'Réunion', 'Comoros', 'São Tomé Island', 'Bahrain', 'Qeshm', 'Kharg Island', 'Abu Musa', 'Greater and Lesser Tunbs', 'Cyprus', 'Crete', 'Corsica', 'Ireland', 'Isle of Man', 'Novaya Zemlya', 'Wrangel Island', 'Franz Josef Land', 'Baffin Island', 'Ellesmere Island', 'Victoria Island (Canada)', 'Vancouver Island', 'Hispaniola', 'Jamaica', 'Trinidad', 'Barbados', 'Martinique', 'Grenada', 'Montserrat', 'Anguilla', 'Saint Martin (island)', 'Bermuda',
    'Easter Island', 'Tierra del Fuego', 'New Caledonia', 'Tahiti', 'Society Islands',
    'Solomon Islands', 'Bougainville Island', 'Guam', 'Tinian', 'Christmas Island', 'Cocos (Keeling) Islands', 'Norfolk Island',
    'Kiribati', 'Gilbert Islands', 'Marshall Islands', 'Tuvalu', 'Tonga', 'Nauru', 'Aldabra', 'Agaléga',
    'Assumption Island', 'Kuril Islands', 'Ryukyu Islands', 'Senkaku Islands', 'Liancourt Rocks', 'Spratly Islands', 'Paracel Islands', 'Scarborough Shoal',
    'Second Thomas Shoal', 'Kinmen', 'Matsu Islands', 'Bear Island (Svalbard)',
  ]),

  // ── Seas, gulfs, bays ──────────────────────────────────────────────────
  ...G('sea', 2, 'syllabus', [
    'Arabian Sea', 'Andaman Sea', 'Laccadive Sea', 'Bay of Bengal', 'Ionian Sea', 'Barents Sea', 'Kara Sea',
    'Laptev Sea', 'East Siberian Sea', 'Chukchi Sea', 'Beaufort Sea', 'Sea of Okhotsk', 'Yellow Sea', 'Bohai Sea', 'Philippine Sea', 'Celebes Sea', 'Sulu Sea',
    'Java Sea', 'Banda Sea', 'Arafura Sea', 'Timor Sea', 'Coral Sea', 'Labrador Sea',
    'Greenland Sea', 'Norwegian Sea', 'Wadden Sea', 'White Sea', 'Gulf of Riga',
  ]),
  ...G('gulf', 2, 'syllabus', [
    'Gulf of Finland', 'Gulf of Sidra', 'Gulf of Panama', 'Gulf of California', 'Gulf of Alaska', 'Gulf of Saint Lawrence',
    'Chesapeake Bay', 'Bay of Fundy', 'Río de la Plata', 'Bay of Campeche', 'Gulf of Bothnia', 'Gulf of Lion', 'Gulf of Khambhat', 'Gulf of Mannar', 'Gulf of Martaban',
    'Gulf of Papua', 'Tokyo Bay', 'Bay of Kiel', 'Walvis Bay', 'Shark Bay', 'James Bay', 'Gulf of Ob', ]),

  // ── Straits, channels, passages ────────────────────────────────────────
  ...G('strait', 2, 'syllabus', [
    'Kerch Strait', 'Strait of Tiran', 'Makassar Strait', 'Karimata Strait', 'Luzon Strait', 'Bashi Channel', 'Tsugaru Strait',
    'Korea Strait', 'La Pérouse Strait', 'Hudson Strait', 'Strait of Juan de Fuca',
    'Yucatán Channel', 'Windward Passage', 'Strait of Otranto', 'Strait of Messina', 'Strait of Sicily', 'Øresund',
    'Skagerrak', 'Kattegat', 'English Channel', 'Palk Strait',
    'Ten Degree Channel', 'Nine Degree Channel', 'Eight Degree Channel', 'Singapore Strait', 'Strait of Johor', 'Northwest Passage', 'Northern Sea Route', 'Nares Strait', 'Fram Strait', 'Denmark Strait', 'Mozambique Channel',
  ]),
  ...G('canal', 2, 'syllabus', ['Grand Canal (China)', 'Volga–Don Canal', 'Erie Canal', 'Corinth Canal', 'Rhine–Main–Danube Canal', 'Saint Lawrence Seaway', 'Istanbul Canal', 'Soo Locks']),

  // ── Land regions: deserts, plateaus, basins, plains, peninsulas ─────────
  ...G('desert', 2, 'syllabus', [
    'Rub\' al Khali', 'Nafud desert', 'Syrian Desert', 'Negev', 'Sinai Peninsula', 'Kyzylkum Desert', 'Dasht-e Kavir', 'Thar Desert', 'Mojave Desert',
    'Simpson Desert', 'Libyan Desert', 'Nubian Desert', 'Danakil Desert',
    'Karoo', 'Registan Desert', 'Sechura Desert', 'Ténéré',
  ]),
  ...G('plateau', 2, 'syllabus', [
    'Iranian Plateau', 'Deccan Plateau', 'Loess Plateau', 'Mongolian Plateau', 'Central Siberian Plateau', 'Armenian Highlands', 'Highveld', 'Laurentian Plateau', 'Ozark Plateau',
    'Mato Grosso Plateau', 'Patagonian Plateau', 'Massif Central', 'Kimberley (Western Australia)', 'Shan Hills',
    'Khorat Plateau', 'Pothohar Plateau', 'Golan Heights',
  ]),
  ...G('plain', 2, 'syllabus', [
    'Great Plains', 'Canadian Prairies', 'Gran Chaco', 'Pampas', 'West Siberian Plain', 'East European Plain', 'North European Plain',
    'Great Hungarian Plain', 'Po Valley', 'North China Plain', 'Mesopotamia', 'Indo-Gangetic Plain', 'Nullarbor Plain', 'Qattara Depression', 'Afar Triangle', 'Tarim Basin', 'Ferghana Valley', 'Bekaa Valley',
    'Jordan Rift Valley', 'Mekong Delta', 'Nile Delta', 'Niger Delta', 'Mississippi River Delta', 'Ganges Delta', 'Irrawaddy Delta', 'Pearl River Delta',
    'Danube Delta', 'Lena Delta', 'Okavango Delta',
  ]),
  ...G('region', 2, 'syllabus', [
    'Arabian Peninsula', 'Balkan Peninsula', 'Scandinavian Peninsula', 'Kola Peninsula', 'Kamchatka Peninsula', 'Korean Peninsula', 'Malay Peninsula', 'Indochina', 'Anatolia', 'Crimea', 'Yucatán Peninsula', 'Baja California Peninsula',
    'Maghreb', 'Levant', 'Caucasus', 'Central Asia',
    'Siberia', 'Outback', 'Ruhr', 'Donets Basin', 'Kuznetsk Basin',
    'Copperbelt Province', 'Witwatersrand', 'Pilbara', 'Mesabi Range', 'Dogger Bank', 'Grand Banks of Newfoundland', 'Wallace Line', 'Ring of Fire',
    'Great Green Wall (Africa)', 'East African Rift', 'Amazon basin', 'Pantanal', 'Llanos', 'Tibet', 'Xinjiang', 'Balochistan', 'Kurdistan', ]),

  // ── Capes, headlands, coasts ───────────────────────────────────────────
  ...G('cape', 2, 'syllabus', [
    'Cape Comorin', 'Cape Guardafui', 'Ras Nouadhibou', 'Cape Finisterre', 'North Cape (Norway)',
    'Cape Chelyuskin', 'Cape Dezhnev', 'Cape Farewell, Greenland', 'Cape Cod', 'Cape Canaveral', 'Cape Hatteras', 'Cape Leeuwin',
    'Cape Reinga', 'Point Barrow', ]),
  ...G('coast', 2, 'syllabus', ['Gold Coast (region)', 'Swahili coast', 'Skeleton Coast', 'Côte d\'Azur', 'Dalmatia', 'Malabar Coast', 'Coromandel Coast', 'Pirate Coast']),
  ...G('waterfall', 2, 'syllabus', ['Kaieteur Falls', 'Boyoma Falls', 'Khone Phapheng Falls', 'Blue Nile Falls', 'Murchison Falls', 'Gullfoss', 'Rhine Falls', 'Inga Falls']),
  ...G('dam', 2, 'syllabus', ['Three Gorges Dam', 'Grand Ethiopian Renaissance Dam', 'Itaipu Dam', 'Tarbela Dam', 'Mangla Dam', 'Atatürk Dam', 'Mosul Dam', 'Kakhovka Dam', 'Medog Hydropower Station', 'Baihetan Dam', 'Rogun Dam', 'Diamer-Bhasha Dam', 'Salma Dam']),

  // ── Ocean floor and reefs ──────────────────────────────────────────────
  ...G('sea', 3, 'syllabus', [
    'Tonga Trench', 'Philippine Trench', 'Peru–Chile Trench', 'Java Trench', 'Mid-Atlantic Ridge', 'East Pacific Rise',
    'Ninety East Ridge', 'Carlsberg Ridge', 'Dogger Bank', 'Mascarene Plateau', ], { sub: 'Ocean floor feature' }),
  ...G('region', 3, 'syllabus', ['Belize Barrier Reef', 'Tubbataha Reefs Natural Park', 'Coral Triangle', 'Great Pacific garbage patch'], { sub: 'Marine area' }),

  // ── Conservation: parks and natural World Heritage sites ────────────────
  ...G('park', 2, 'conservation', [
    'Serengeti National Park', 'Ngorongoro Conservation Area', 'Maasai Mara', 'Nyerere National Park', 'Kruger National Park', 'Virunga National Park',
    'Bwindi Impenetrable National Park', 'Etosha National Park', 'Central Kalahari Game Reserve',
    'Chobe National Park', 'Tsingy de Bemaraha Strict Nature Reserve',
    'Yellowstone National Park', 'Yosemite National Park', 'Everglades National Park', 'Banff National Park', 'Galápagos National Park', 'Manú National Park', 'Torres del Paine National Park', 'Los Glaciares National Park',
    'Iguazú National Park', 'Canaima National Park', 'Kakadu National Park', 'Uluṟu-Kata Tjuṯa National Park', 'Fiordland National Park',
    'Komodo National Park', 'Kinabalu Park', 'Ha Long Bay', 'Phong Nha-Kẻ Bàng National Park',
    'Chitwan National Park', 'Sagarmatha National Park', 'Royal Manas National Park', 'Sundarbans', 'Białowieża Forest', 'Plitvice Lakes National Park',
    'Jiuzhaigou', 'Zhangjiajie National Forest Park', 'Lake Baikal', 'Virgin Komi Forests', 'Wadi Rum', 'Socotra', 'Great Barrier Reef', 'Aldabra', 'Tubbataha Reefs Natural Park', ]),

  // ── Geopolitics and current affairs ────────────────────────────────────
  ...G('strategic', 1, 'current-affairs', [
    ['Nagorno-Karabakh', { sub: 'Region in Azerbaijan' }], ['Lachin corridor', { sub: 'Mountain road corridor' }], ['Syunik Province', { sub: 'Province (Zangezur corridor)' }],
    ['Nakhchivan Autonomous Republic', { sub: 'Exclave of Azerbaijan' }], ['Gaza Strip', { sub: 'Palestinian territory' }], ['West Bank', { sub: 'Palestinian territory' }],
    ['Rafah', { sub: 'Border city' }], ['Philadelphi Corridor', { sub: 'Border strip' }], ['Golan Heights', { sub: 'Occupied plateau' }], ['East Jerusalem', { sub: 'Disputed city sector' }],
    ['Donetsk Oblast', { sub: 'Region of Ukraine' }], ['Luhansk Oblast', { sub: 'Region of Ukraine' }], ['Zaporizhzhia Nuclear Power Plant', { sub: 'Nuclear power plant' }],
    ['Kherson', { sub: 'City' }], ['Bakhmut', { sub: 'City' }], ['Avdiivka', { sub: 'City' }], ['Kursk Oblast', { sub: 'Region of Russia' }], ['Pokrovsk, Ukraine', { sub: 'City' }],
    ['Chernobyl Exclusion Zone', { sub: 'Exclusion zone' }], ['Transnistria', { sub: 'Breakaway region of Moldova' }], ['Abkhazia', { sub: 'Breakaway region of Georgia' }],
    ['South Ossetia', { sub: 'Breakaway region of Georgia' }], ['Kaliningrad Oblast', { sub: 'Exclave of Russia' }], ['Suwałki Gap', { sub: 'Land corridor' }],
    ['Northern Cyprus', { sub: 'Breakaway region of Cyprus' }], ['Western Sahara', { sub: 'Disputed territory' }],
    ['Darfur', { sub: 'Region of Sudan' }], ['El Fasher', { sub: 'City' }], ['Kordofan', { sub: 'Region of Sudan' }], ['Abyei', { sub: 'Disputed area' }],
    ['Somaliland', { sub: 'Self-declared state' }], ['Puntland', { sub: 'Autonomous region of Somalia' }], ['Ogaden', { sub: 'Region of Ethiopia' }], ['Goma', { sub: 'City' }],
    ['Bukavu', { sub: 'City' }], ['North Kivu', { sub: 'Province of DR Congo' }], ['Ituri Province', { sub: 'Province of DR Congo' }],
    ['Tindouf', { sub: 'Refugee camps city' }], ['Rakhine State', { sub: 'State of Myanmar' }], ['Chin State', { sub: 'State of Myanmar' }], ['Wakhan Corridor', { sub: 'Narrow corridor' }],
    ['Panjshir Valley', { sub: 'Valley' }], ['Idlib', { sub: 'City' }], ['Kobani', { sub: 'Border town' }], ['Deir ez-Zor', { sub: 'City' }], ['Sinjar', { sub: 'Town' }],
    ['Erbil', { sub: 'Capital of Kurdistan Region' }], ['Hodeidah', { sub: 'Port city' }], ['Marib', { sub: 'City' }], ['Fordow Fuel Enrichment Plant', { sub: 'Nuclear facility' }],
    ['Natanz Nuclear Facility', { sub: 'Nuclear facility' }], ['Bushehr Nuclear Power Plant', { sub: 'Nuclear power plant' }], ['Gwadar Port', { sub: 'Port (CPEC)' }],
    ['China–Pakistan Economic Corridor', { sub: 'Economic corridor' }], ['International North–South Transport Corridor', { sub: 'Transport corridor' }],
    ['India–Middle East–Europe Economic Corridor', { sub: 'Economic corridor' }], ['Gibraltar', { sub: 'British overseas territory' }],
    ['Ceuta', { sub: 'Spanish enclave' }], ['Melilla', { sub: 'Spanish enclave' }], ['Svalbard', { sub: 'Arctic archipelago' }], ['Greenland', { sub: 'Arctic island' }],
    ['Diego Garcia', { sub: 'Military base island' }], ['Port Sudan', { sub: 'Port city' }], ['Hambantota International Port', { sub: 'Port' }],
    ['Kyaukphyu', { sub: 'Deep-sea port' }], ['Ream Naval Base', { sub: 'Naval base' }], ['Taiwan Strait', { sub: 'Strait' }], ['Korean Demilitarized Zone', { sub: 'Demilitarized zone' }],
    ['Kaesong', { sub: 'City' }], ['Sabah', { sub: 'State of Malaysia' }], ['Mindanao', { sub: 'Island' }], ['Papua (province)', { sub: 'Province of Indonesia' }],
    ['Bougainville Island', { sub: 'Autonomous region' }], ['New Caledonia', { sub: 'French territory' }], ['Falkland Islands', { sub: 'Disputed islands' }],
    ['Darién Gap', { sub: 'Jungle crossing' }], ['Strait of Hormuz', { sub: 'Strait' }], ['Bab-el-Mandeb', { sub: 'Strait' }],
  ]),

  // ── Cities: previous papers and major world cities ──────────────────────
  ...G('city', 3, 'pyq', [
    'Istanbul', 'Adana', 'İzmir', 'Halifax, Nova Scotia', 'Verkhoyansk', 'Zurich', 'Ghazni', 'Fergana', 'Kandahar', 'Samarkand', 'Pisa', 'Bujumbura', 'Christchurch',
    'Ramallah', 'Ramadi', 'Tikrit', 'Gartok', 'Baikonur', 'Bandung', 'Batticaloa', 'Durban', 'Brisbane', 'Melbourne', 'Davos', 'Barcelona', 'Auckland', 'Kandy',
    'San Francisco', 'Nagoya', 'Sendai', 'Osaka', 'Belfast', 'Aberdeen', 'Leeds', 'Liverpool', 'Cologne', 'New Orleans', 'Antwerp', 'Buffalo, New York',
    'Gary, Indiana', 'Hamilton, Ontario', 'Nuuk',
  ]),
  ...G('city', 2, 'syllabus', [
    'Los Angeles', 'Toronto', 'São Paulo', 'Lagos', 'Casablanca', 'Johannesburg', 'Cape Town', 'Dakar',
    'Dar es Salaam', 'Karachi', 'Mumbai', 'Dubai', 'Doha', 'Jeddah', 'Mecca', 'Jerusalem', 'Tel Aviv', 'Damascus', 'Mashhad', 'Isfahan', 'Almaty', 'Vladivostok', 'Murmansk', 'Saint Petersburg', 'Norilsk', 'Urumqi', 'Kashgar', 'Chongqing', 'Guangzhou', 'Shenzhen', 'Hong Kong', 'Pyongyang', 'Osaka', 'Hiroshima', 'Nagasaki', 'Fukushima (city)',
    'Manila', 'Penang', 'Darwin, Northern Territory', 'Frankfurt', 'Odesa', 'Kharkiv', 'Mariupol', 'Sevastopol', ]),
]
