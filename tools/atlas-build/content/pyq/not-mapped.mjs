/**
 * Names that previous-year questions mention but that are deliberately not
 * atlas places, each with the reason. The build moves ledger references to
 * these names from `unmatched` to `explained` in reports/pyq-review.json, so
 * the unmatched list only shows work that is still open.
 *
 * Add a place instead (content/*.mjs, with `src`) when one of these becomes
 * worth mapping, and delete its line here.
 */

const RIVER = 'Indian river with no drawn course on the India sheet; adding it needs a full sheet build with a traced course (see HANDOFF)'
const TOWN = 'Town asked in only one question of the collected papers; the atlas adds towns asked in two or more questions or in UPSC Prelims'
const WORLD_CITY = 'World city (not a national capital) asked in only one question of the collected papers'
const LOCAL = 'Local site (beach, small lake, waterfall, shrine or small dam) below the atlas’s level of detail'
const MINOR = 'Minor feature asked once in the collected papers; not added'
const ISLAND = 'Small island or island group below the atlas’s level of detail'
const DISTRICT = 'District or province; the atlas maps states and countries, not smaller administrative areas'
const NO_COORDS = 'No reliable coordinates found on Wikipedia or Wikidata; left out rather than guessed'
const PLAIN_NAME = 'Regional name for part of the Ganga plain with no fixed extent or point'
const HIMALAYA_DIVISION = 'Regional division of the Himalaya with no reliable point location or source page'

export default {
  // Indian rivers without a course on the sheet
  Mandakini: RIVER, Rihand: RIVER, Barakar: RIVER, Tons: RIVER, Bhilangna: RIVER, Pranhita: RIVER, Kshipra: RIVER,
  Vamsadhara: RIVER, Rohini: RIVER, Sai: RIVER, Pindar: RIVER, Sindh: RIVER, Mahananda: RIVER, Punpun: RIVER, Ajoy: RIVER,
  Jalangi: RIVER, Jonk: RIVER, 'Doodh Ganga': RIVER, Hemavathi: RIVER, Doni: RIVER, Tel: RIVER, Hagari: RIVER, Jamunia: RIVER,
  Barki: RIVER, Sankosh: RIVER, 'Mithi River': RIVER, Machkund: RIVER, Tawa: RIVER, Mayurakshi: RIVER, Konar: RIVER,
  Korapuzha: RIVER, Pamba: RIVER, Nagavali: RIVER, Rangeet: RIVER, Kalinadi: RIVER, Spiti: RIVER, Kunthi: RIVER, Penganga: RIVER,
  Paleru: RIVER, Kangsabati: 'Kangsabati river and reservoir: the river has no course on the India sheet (see HANDOFF)',

  // No reliable coordinates
  'Chhattisgarh Plain': NO_COORDS, 'Brahmagiri Hills': NO_COORDS, 'Gawilgarh Hills': NO_COORDS, 'Sela Lake': NO_COORDS,
  Kakrapar: NO_COORDS, 'Kol Dam': NO_COORDS, Kamadgiri: NO_COORDS, 'Miri Hills': NO_COORDS, Aghil: NO_COORDS, 'Muling La': NO_COORDS,
  'Sin La': NO_COORDS, 'Naupada Swamp': NO_COORDS, 'Rundun Glacier': NO_COORDS, 'Sasaini Glacier': NO_COORDS,
  Didwana: 'Salt lake of Rajasthan; Wikipedia has coordinates only for the town, not the lake',
  Kuchaman: 'Salt lake of Rajasthan without reliable lake coordinates', Sargol: 'Salt lake of Rajasthan without reliable lake coordinates',
  Khatu: 'Salt lake of Rajasthan without reliable lake coordinates',

  // Named features that are not separate atlas places
  'Kumaon Himalaya': HIMALAYA_DIVISION, 'Punjab Himalaya': HIMALAYA_DIVISION, 'Nepal Himalaya': HIMALAYA_DIVISION, 'Sikkim Himalaya': HIMALAYA_DIVISION,
  Tulbul: 'Tulbul navigation project on the Jhelum at the outlet of Wular Lake (an atlas place); not a separate place',
  Nokrek: 'The atlas has Nokrek National Park, which surrounds the peak; the peak itself has no reliable coordinates',
  'Ladakh Plateau': 'Not a distinct mapped feature; the atlas has the Ladakh Range and Changthang',
  'Periyar Lake': 'Reservoir inside Periyar Tiger Reserve (an atlas place); not a separate place',
  'New Moore': 'Island in the Hariabhanga estuary that had disappeared under the sea by 2010',
  Kapilvastu: 'Site of ancient Kapilavastu is disputed (Piprahwa in India, Tilaurakot in Nepal)',
  Bugyal: 'Generic term for Himalayan alpine meadows, not one place',
  'Trans-Saryu Plain': PLAIN_NAME, 'Saryupar Plain': PLAIN_NAME, 'Ganga-Ghaghara Doab': PLAIN_NAME,
  'Mount Erebus': 'In Antarctica, outside the world sheet',
  Florida: DISTRICT, Tirap: DISTRICT, Kinnaur: DISTRICT, Mewat: 'Cultural region spread over three states; no fixed extent', 'Lakhimpur Kheri': DISTRICT,

  // Minor physical features
  'Mandav Hills': MINOR, 'Bateshwar Hill': MINOR, 'Bilari Range': MINOR, 'Dhosi Hill': MINOR, 'Mount Thuillier': MINOR,
  'Tirumala Hills': MINOR, 'Chamundi Hills': MINOR, 'Black Mountain': MINOR, 'Coconino Plateau': MINOR, 'Aquarius Plateau': MINOR,
  'Panjshir Valley': MINOR, 'Taylor Valley': MINOR, 'Valley of the Kings': MINOR, 'Chisapani Gorge': MINOR, 'Jiaozhou Bay': MINOR,
  'Soo Canal': MINOR, 'Red River': MINOR, Scheldt: MINOR, Kafue: MINOR, 'Tennessee River': MINOR, Vakhsh: MINOR, 'Huangpu River': MINOR,
  Zangmu: MINOR,

  // Local sites
  Digha: LOCAL, Calangute: LOCAL, 'Marina Beach': LOCAL, 'Deva Sharif': LOCAL, Devipatan: LOCAL, 'Dhanraul Dam': LOCAL,
  'Powai Lake': LOCAL, 'Vihar Lake': LOCAL, 'Tulsi Lake': LOCAL, 'Chapanala Lake': LOCAL, 'Jor Pokhri': LOCAL, Dodital: LOCAL,
  'Red Hills Lake': LOCAL, 'Anchar Lake': LOCAL, Surajkund: LOCAL, 'Ghepan Lake': LOCAL, 'Badkhal Lake': LOCAL,
  'Barkana Falls': LOCAL, Palani: LOCAL, 'Rakim Kund Falls': LOCAL, 'Kevti Falls': LOCAL, 'Chulia Falls': LOCAL, 'Landshing Falls': LOCAL,
  'Boiling Lake': LOCAL, 'Five Flower Lake': LOCAL, 'Laguna Colorada': LOCAL, 'Plitvice Lakes': LOCAL, 'Lake Itasca': LOCAL,
  'Lake Timsah': LOCAL, 'Great Bitter Lake': LOCAL, 'Little Bitter Lake': LOCAL, 'Lake Manzala': LOCAL,

  // Small islands
  'Henry Island': ISLAND, Martinique: ISLAND, 'Christmas Island': ISLAND, 'Bear Island': ISLAND, 'Franz Josef Land': ISLAND,
  'Solomon Islands': ISLAND, 'Gilbert Islands': ISLAND, 'Society Islands': ISLAND, 'Marshall Islands': ISLAND, 'Isle of Man': ISLAND,
  'Saint Martin': ISLAND, 'Norfolk Island': ISLAND, 'Paracel Islands': ISLAND, Grenada: ISLAND, Montserrat: ISLAND, Anguilla: ISLAND,
  Tonga: ISLAND, Tuvalu: ISLAND, Tahiti: ISLAND, Tinian: ISLAND,

  // Indian towns asked once
  Bikaner: TOWN, Virudhunagar: TOWN, Channapatna: TOWN, Alang: TOWN, Chakrata: TOWN, Haflong: TOWN, Kalimpong: TOWN, Kufri: TOWN,
  Walong: TOWN, 'Mount Abu': TOWN, Kannur: TOWN, Nagercoil: TOWN, Sindhudurg: TOWN, Udupi: TOWN, Mandapam: TOWN, Bhatkal: TOWN,
  Arnala: TOWN, Palanpur: TOWN, Hubli: TOWN, Guntur: TOWN, Ambala: TOWN, Rohtak: TOWN, Bithoor: TOWN, Jaunpur: TOWN, Sultanpur: TOWN,
  Maghar: TOWN, Nizamabad: TOWN, Jalesar: TOWN, Renukoot: TOWN, Rishikesh: TOWN, Shahjahanpur: TOWN, Churk: TOWN, Chinhat: TOWN,
  Pilibhit: TOWN, Cuttack: TOWN, Tezpur: TOWN, Honnavar: TOWN, Malpe: TOWN, Harsud: TOWN, Bokaro: TOWN, Asansol: TOWN,
  Bhadravati: TOWN, Gwalior: TOWN, Sagar: TOWN, Hazira: TOWN, Alappuzha: TOWN, Krishnapatnam: TOWN, Jamnagar: TOWN, Ratnagiri: TOWN,
  Udvada: TOWN, Gulmarg: TOWN, Kasauli: TOWN, Auli: TOWN, Keylong: TOWN, Chikmagalur: TOWN, Kuldhara: TOWN, Lakhpat: TOWN,
  Charkhari: TOWN, Khajjiar: TOWN, Pahalgam: TOWN, Pokhran: TOWN, Sitapur: TOWN, Achra: TOWN, Sihawa: TOWN,

  // World cities asked once
  Istanbul: WORLD_CITY, Adana: WORLD_CITY, Izmir: WORLD_CITY, Halifax: WORLD_CITY, Verkhoyansk: WORLD_CITY, Zurich: WORLD_CITY,
  Ghazni: WORLD_CITY, Fergana: WORLD_CITY, Kandahar: WORLD_CITY, Samarkand: WORLD_CITY, Pisa: WORLD_CITY,
  Bujumbura: 'Former capital of Burundi (Gitega since 2019); asked in only one question', Christchurch: WORLD_CITY,
  Ramallah: WORLD_CITY, Ramadi: WORLD_CITY, Tikrit: WORLD_CITY, Gartok: WORLD_CITY, Baikonur: WORLD_CITY, Bandung: WORLD_CITY,
  Batticaloa: WORLD_CITY, Durban: WORLD_CITY, Brisbane: WORLD_CITY, Melbourne: WORLD_CITY, Davos: WORLD_CITY, Barcelona: WORLD_CITY,
  Auckland: WORLD_CITY, Kandy: WORLD_CITY, 'San Francisco': WORLD_CITY, Nagoya: WORLD_CITY, Sendai: WORLD_CITY, Osaka: WORLD_CITY,
  Belfast: WORLD_CITY, Aberdeen: WORLD_CITY, Leeds: WORLD_CITY, Liverpool: WORLD_CITY, Cologne: WORLD_CITY, 'New Orleans': WORLD_CITY,
  Antwerp: WORLD_CITY, Buffalo: WORLD_CITY, Gary: WORLD_CITY, Hamilton: WORLD_CITY, Nuuk: WORLD_CITY,
}
