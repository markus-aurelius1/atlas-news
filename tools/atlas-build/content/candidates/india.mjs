/**
 * India sheet: candidates beyond the designated-site lists in lists/ (Ramsar,
 * tiger reserves, national parks, biosphere reserves). Chosen for UPSC/UPPSC
 * mapping value: names asked in previous papers (content/pyq), standard
 * NCERT/syllabus features, strategic and border locations, and places in
 * recent current affairs. `why` records the reason.
 */
import { G } from './dsl.mjs'

export default [
  // ── Rivers asked in previous papers that the atlas did not have ─────────
  ...G('river', 3, 'pyq', [
    'Mandakini River', 'Rihand River', 'Barakar River', ['Tons River', { name: 'Tons' }], 'Bhilangna River', 'Pranhita River',
    'Shipra River', 'Vamsadhara River', 'Rohini River', ['Sai River (Uttar Pradesh)', { name: 'Sai' }], 'Pindar River', ['Sindh River', { name: 'Sindh' }],
    'Mahananda River', 'Punpun River', 'Ajay River', 'Jalangi River', 'Jonk River', 'Hemavati River', 'Don River (India)',
    'Tel River', ['Vedavathi River', { name: 'Vedavati (Hagari)' }], 'Sankosh River', 'Mithi River', 'Tawa River', 'Mayurakshi River', 'Konar River',
    'Korapuzha River', 'Pamba River', 'Nagavali River', 'Rangeet River', 'Kali River (Karnataka)', 'Spiti River', 'Penganga River', 
    'Kangsabati River',
  ]),
  // Standard tributaries (NCERT drainage).
  ...G('river', 3, 'syllabus', [
    'Chandra River', 'Bhaga River', 'Dhauliganga River', 'Saryu River', 'Kali Sindh River', 'Parbati River (Rajasthan)', 'Karmanasa River',
    'Bagmati River', 'Burhi Gandak River', 'Falgu River', 'North Koel River', 'Hasdeo River', 'Seonath River', 'Ib River', 'Purna River (tributary of Tapti)',
    'Sina River', 'Sileru River', 'Chitravathi River', 'Noyyal River', 'Amaravathi River',
    'Chaliyar', 'Zuari River', 'Vaitarna River', 'Damanganga River', 'Torsa River',
    'Kopili River', 'Tlawng River', 'Gumti River', 'Imphal River', 'Suru River (Indus)', 'Nubra River', 'Tawi River', 'Giri River', 'Varuna River',
  ]),

  // ── Peaks ──────────────────────────────────────────────────────────────
  ...G('peak', 3, 'syllabus', [
    'Nanda Kot', 'Chaukhamba', 'Shivling (mountain)', 'Kedarnath (mountain)', 'Panchachuli', 'Changabang', 'Saser Kangri', 'Kun (mountain)', 'Stok Kangri',
    'Harmukh', 'Kabru', 'Chomolhari', 'Mount Japfü', 'Kudremukh', 'Arma Konda', 'Shillong Peak',
    'Agasthyamalai',
    ['Manaslu', { co: 'NPL' }], ['Tirich Mir', { co: 'PAK' }], ['Gangkhar Puensum', { co: 'BTN' }],
  ]),

  // ── Passes ─────────────────────────────────────────────────────────────
  ...G('pass', 3, 'syllabus', [
    'Umling La', 'Marsimik La', 'Lanak La', 'Fotu La', 'Shinku La', 'Thang La', 'Kongka La', 'Bomdi La', 'Kasara Ghat', 'Agumbe', 'Mintaka Pass', 'Kilik Pass', 'Wakhjir Pass',
  ]),

  // ── Glaciers ───────────────────────────────────────────────────────────
  ...G('glacier', 3, 'syllabus', [
    'Machoi Glacier', 'Drang-Drung Glacier', 'Parkachik Glacier', 'Chhota Shigri', 'Kafni Glacier', 'Dokriani Glacier',
    'Rathong Glacier', 'Pensilungpa Glacier',
  ]),

  // ── Lakes and reservoirs (beyond the Ramsar list) ───────────────────────
  ...G('lake', 3, 'syllabus', [
    'Sheshnag Lake', 'Gangabal Lake', 'Manasbal Lake', 'Anchar Lake', 'Bhimtal Lake', 'Dodital', 'Umiam Lake', 'Son Beel',
    'Govind Ballabh Pant Sagar', 'Lake Pichola', 'Jaisamand Lake', 'Rajsamand Lake', 'Powai Lake', 'Didwana Lake',
  ]),

  // ── Dams, barrages and hydro projects ──────────────────────────────────
  ...G('dam', 3, 'syllabus', [
    'Nathpa Jhakri Dam', 'Chamera Dam', 'Uri Dam', 'Kishanganga Hydroelectric Plant', 'Pakal Dul Dam', 'Ratle Hydroelectric Plant', 'Subansiri Lower Dam',
    'Tipaimukh Dam', 'Kabini Dam', 'Prakasam Barrage', 'Kaleshwaram Lift Irrigation Project', 'Mahi Bajaj Sagar Dam', 'Tawa Dam', 'Bargi Dam', 'Omkareshwar Dam', 'Shahpurkandi dam project',
    'Jayakwadi Dam', 'Teesta Barrage', 'Obra Dam',
  ]),

  ...G('dam', 3, 'pyq', ['Dhanraul Dam']),

  // ── Ports ──────────────────────────────────────────────────────────────
  ...G('port', 3, 'syllabus', [
    'Vadhavan Port', 'Krishnapatnam Port', 'Gangavaram Port', 'Dhamra Port', 'Hazira Port', 'Port Pipavav', 'Azhikkal Port',
    'Colachel', 'Machilipatnam Port', 'Alang', 'International Container Transshipment Port, Galathea Bay',
  ]),

  // ── Islands ────────────────────────────────────────────────────────────
  ...G('island', 3, 'syllabus', [
    'Ritchie\'s Archipelago', 'Baratang Island', 'Rutland Island', 'Little Nicobar', 'Katchal Island', 'Kamorta Island', ['Coco Islands', { co: 'MMR' }], ['Agatti Island', { st: 'lakshadweep' }], ['Kalpeni', { st: 'lakshadweep' }], 'Andrott', 'Pitti Island', 'Krusadai Island', 'Willingdon Island', 'Bet Dwarka', 'Khadir Bet', 'Sagar Island', 'Ghoramara Island', 'Jambudwip', 'Pamban Island',
  ]),

  // ── Waterfalls ─────────────────────────────────────────────────────────
  ...G('waterfall', 3, 'syllabus', [
    'Barehipani Falls', 'Nohsngithiang Falls', 'Langshiang Falls', 'Nuranang Falls', 'Thoseghar Waterfalls', 'Magod Falls',
    'Courtallam', 'Dassam Falls', 'Tirathgarh Falls', 'Keoti Falls', 'Rakim Kund Falls', 'Chulia Falls',
  ]),

  // ── Regions, plateaus, plains, coasts, ranges ───────────────────────────
  ...G('region', 3, 'syllabus', [
    'Dooars', 'Vidarbha', 'Marathwada', 'Rayalaseema', 'Saurashtra (region)', 'Mewar', 'Marwar', 'Hadoti', 'Shekhawati', 'Kodagu district', 'Wayanad',
    'Purvanchal', 'Barind Tract', 'Tulu Nadu',
  ]),
  ...G('plateau', 3, 'syllabus', ['Hazaribagh Plateau', 'Ranchi Plateau', 'Pat region']),
  ...G('plain', 3, 'syllabus', ['Eastern Coastal Plains', 'Western Coastal Plains']),
  ...G('range', 3, 'syllabus', [
    'Saltoro Mountains', 'Mussoorie Range', 'Mikir Hills', 'Barail Range', 'Dafla Hills', 'Abor Hills', 'Chittagong Hill Tracts', 'Rajpipla hills',
    'Ajanta range', 'Palkonda Range', 'Pachaimalai Hills', 'Baba Budan Giri', 'Gawilgarh Hills', 'Girnar',
  ]),

  // ── Strategic, border and corridor locations ───────────────────────────
  ...G('strategic', 2, 'strategic', [
    ['Depsang Plains', { sub: 'Disputed plain on the LAC' }], ['Demchok, Ladakh', { sub: 'Border village on the LAC' }], ['Chushul', { sub: 'Border village on the LAC' }],
    ['Daulat Beg Oldi', { sub: 'Forward airbase' }], ['Nyoma', { sub: 'Airbase' }], ['Hot Springs, Ladakh', { sub: 'Border point on the LAC' }],
    ['Yangtse, Arunachal Pradesh', { sub: 'Border area on the LAC' }], ['Kibithu', { sub: 'Easternmost village' }], ['Walong', { sub: 'Border town' }],
    ['Tin Bigha Corridor', { sub: 'Border corridor' }], ['Kartarpur Corridor', { sub: 'Border corridor' }], ['Attari', { sub: 'Border crossing' }],
    ['Munabao', { sub: 'Border crossing' }], ['Longewala', { sub: 'Border post, 1971 battle site' }], ['Petrapole', { sub: 'Land port on the Bangladesh border' }],
    ['Dawki', { sub: 'Border town' }], ['Zokhawthar', { sub: 'Border crossing with Myanmar' }], ['Raxaul', { sub: 'Border crossing with Nepal' }],
    ['Susta territory', { sub: 'Disputed area with Nepal' }], ['Saltoro Ridge', { sub: 'Ridge on the Actual Ground Position Line' }], ['Line of Control', { sub: 'Military control line' }],
    ['Line of Actual Control', { sub: 'Border line with China' }], ['McMahon Line', { sub: 'Boundary line' }], ['Jaffna Peninsula', { sub: 'Peninsula', co: 'LKA' }],
    ['Kyaukphyu', { sub: 'Port and pipeline terminus', co: 'MMR' }], ['Trans-Karakoram Tract', { sub: 'Tract ceded by Pakistan to China (1963)' }],
  ]),
  // Defence, space and nuclear facilities that appear in mapping questions and the news.
  ...G('facility', 3, 'strategic', [
    ['INS Kadamba', { sub: 'Naval base' }], ['Great Nicobar Island Development Project', { sub: 'Development project' }], ['Kulasekarapattinam', { sub: 'Spaceport site' }],
    ['Challakere', { sub: 'Aeronautical test range' }], ['Integrated Test Range', { sub: 'Missile test range' }], ['Pokhran', { sub: 'Nuclear test site' }],
    ['Tarapur Atomic Power Station', { sub: 'Nuclear power plant' }], ['Kudankulam Nuclear Power Plant', { sub: 'Nuclear power plant' }],
    ['Madras Atomic Power Station', { sub: 'Nuclear power plant' }], ['Jaitapur Nuclear Power Project', { sub: 'Planned nuclear power plant' }],
    ['Kakrapar Atomic Power Station', { sub: 'Nuclear power plant' }], ['Rajasthan Atomic Power Station', { sub: 'Nuclear power plant' }],
    ['Narora Atomic Power Station', { sub: 'Nuclear power plant' }], ['Kaiga Atomic Power Station', { sub: 'Nuclear power plant' }],
    ['Gorakhpur Nuclear Power Plant', { sub: 'Nuclear power plant (under construction)' }], ['Bhabha Atomic Research Centre', { sub: 'Nuclear research centre' }],
  ]),

  // ── Cities and towns asked in previous papers ──────────────────────────
  ...G('city', 3, 'pyq', [
    'Bikaner', 'Virudhunagar', 'Channapatna', 'Chakrata', 'Haflong', 'Kalimpong', 'Kufri, India', 'Kannur', 'Nagercoil', 'Udupi', 'Mandapam', 'Bhatkal', 'Arnala fort',
    'Palanpur', 'Hubli', 'Guntur', 'Ambala', 'Rohtak', 'Bithoor', 'Jaunpur, Uttar Pradesh', 'Sultanpur, Uttar Pradesh', 'Maghar, India', 'Nizamabad, Telangana', 'Jalesar',
    'Renukoot', 'Rishikesh', 'Shahjahanpur', 'Churk', 'Chinhat', 'Pilibhit', 'Cuttack', 'Tezpur', 'Honnavar', 'Malpe', 'Harsud', 'Bokaro Steel City',
    'Asansol', 'Bhadravati, Karnataka', 'Gwalior', 'Sagar, Madhya Pradesh', 'Alappuzha', 'Jamnagar', 'Ratnagiri', 'Udvada', 'Gulmarg', 'Kasauli',
    'Auli, India', 'Keylong', 'Chikmagalur', 'Kuldhara', 'Lakhpat', 'Charkhari', 'Khajjiar', 'Pahalgam', 'Sitapur', 'Mount Abu', 'Digha', 'Palani',
    'Devipatan', 'Deva Sharif',
  ]),
  // Important cities (industry, transport, administration, history).
  ...G('city', 2, 'syllabus', [
    'Warangal', 'Tirupati', 'Kolhapur', 'Belagavi', 'Thanjavur', 'Korba, Chhattisgarh',
    'Jorhat', 'Digboi', 'Dimapur', 'Singrauli', 'Ballari',
    'Neyveli', 'Ramagundam', 'Pathankot', 'Panipat', 'Almora', 'Joshimath', 'Anantnag', 'Baramulla',
    'Pasighat', 'Ziro', 'Rajgir', 'Bodh Gaya', 'Gaya, India',
  ]),
]
