import { P } from './dsl.mjs'

const trace = (from, to) => ({ trace: { from, to } })
const course = (...pts) => ({ course: pts })

export default [
  // ── Indus system ────────────────────────────────────────────────────────
  P('river', 'Indus', 34.16, 77.58, {
    lvl: 1, st: ['ladakh'], aka: ['Sindhu', 'Sengge Zangbo'],
    rel: { source: 'lake.manasarovar', flowsInto: 'sea.arabian-sea' },
    f: ['Rises in Tibet near Lake Manasarovar and enters India in Ladakh near Demchok.', 'Flows past Leh; its Indian tributaries are the Jhelum, Chenab, Ravi, Beas and Sutlej.', 'The Indus Waters Treaty (1960) gives India the eastern rivers (Ravi, Beas, Sutlej) and Pakistan the western ones.'],
  }),
  P('river', 'Zanskar', 33.85, 77.05, {
    lvl: 2, st: ['ladakh'], rel: { tributaryOf: 'river.indus', bank: 'left' }, line: trace([33.47, 76.88]),
    f: ['Joins the Indus at Nimmu, west of Leh.', 'Its frozen gorge becomes the winter Chadar trek.'],
  }),
  P('river', 'Shyok', 34.7, 77.9, {
    lvl: 2, st: ['ladakh'], rel: { tributaryOf: 'river.indus', bank: 'right' }, line: trace([35.4, 77.62]),
    f: ['Rises at the Rimo glacier and receives the Nubra, fed by the Siachen glacier.', 'Called the "river of death"; it joins the Indus in Gilgit-Baltistan.'],
  }),
  P('river', 'Jhelum', 34.02, 74.6, {
    lvl: 1, st: ['jammu-and-kashmir'], aka: ['Vitasta'], rel: { tributaryOf: 'river.chenab' },
    f: ['Rises at the Verinag spring and flows through the Kashmir Valley, Srinagar and Wular lake.', 'Joins the Chenab at Trimmu in Pakistan.', 'Kishanganga (Neelum) joins it near Muzaffarabad.'],
  }),
  P('river', 'Kishanganga', 34.62, 74.85, {
    lvl: 3, st: ['jammu-and-kashmir'], aka: ['Neelum'], rel: { tributaryOf: 'river.jhelum', bank: 'right' }, line: trace([34.42, 75.12]),
    f: ['Called the Neelum in Pakistan-occupied Kashmir.', 'The Kishanganga hydroelectric project diverts its water to the Jhelum basin (upheld by the Court of Arbitration, 2013).'],
  }),
  P('river', 'Chenab', 33.25, 75.8, {
    lvl: 1, st: ['himachal-pradesh', 'jammu-and-kashmir'], aka: ['Chandrabhaga', 'Asikni'], rel: { tributaryOf: 'river.indus', bank: 'left', source: 'confluence.tandi' },
    f: ['Formed by the Chandra and Bhaga at Tandi in Lahaul.', 'The largest tributary of the Indus by volume.', 'The Chenab rail bridge near Reasi is the world’s highest railway arch bridge.'],
  }),
  P('river', 'Ravi', 32.5, 76.1, {
    lvl: 1, st: ['himachal-pradesh', 'punjab'], aka: ['Parushni', 'Iravati'], rel: { tributaryOf: 'river.chenab', bank: 'left' },
    f: ['Rises in the Bara Bhangal area of the Dhauladhar and flows through the Chamba valley.', 'The Ranjit Sagar (Thein) dam is on the Ravi; it enters Pakistan near Amritsar and flows past Lahore.'],
  }),
  P('river', 'Beas', 31.85, 77.0, {
    lvl: 1, st: ['himachal-pradesh', 'punjab'], aka: ['Vipasha'], rel: { tributaryOf: 'river.sutlej', bank: 'right', source: 'pass.rohtang' },
    f: ['Rises at Beas Kund near the Rohtang pass and flows through the Kullu valley.', 'Pong dam (Maharana Pratap Sagar) is on the Beas; it joins the Sutlej at Harike.', 'The only Indus tributary that flows wholly within India.'],
  }),
  P('river', 'Sutlej', 31.45, 77.65, {
    lvl: 1, st: ['himachal-pradesh', 'punjab'], aka: ['Satluj', 'Satadru', 'Langqen Zangbo'], rel: { tributaryOf: 'river.chenab', source: 'lake.rakshastal' },
    f: ['Rises near Rakshastal in Tibet and enters India at the Shipki La.', 'Bhakra Nangal dam (Gobind Sagar) and Nathpa Jhakri are on the Sutlej.', 'Joins the Beas at Harike and forms part of the India–Pakistan border.'],
  }),
  P('river', 'Ghaggar', 29.75, 75.0, {
    lvl: 2, st: ['himachal-pradesh', 'haryana', 'punjab', 'rajasthan'], aka: ['Ghaggar-Hakra'], line: trace([30.75, 77.05], [29.45, 74.0]),
    f: ['A seasonal river that rises in the Shivalik hills and dies out in the Thar desert.', 'Often identified with the Vedic Saraswati; many Harappan sites (Kalibangan, Rakhigarhi) lie in its basin.'],
  }),
  P('river', 'Luni', 25.75, 72.55, {
    lvl: 1, st: ['rajasthan', 'gujarat'], aka: ['Lavanavari'], rel: { flowsInto: 'desert.rann-of-kutch' }, line: trace([26.45, 74.55], [24.75, 71.25]),
    f: ['Rises in the Pushkar valley of the Aravalli near Ajmer.', 'The only river of the Thar desert; its water turns saline below Balotra.', 'It does not reach the sea but ends in the marshes of the Rann of Kutch.'],
  }),
  P('river', 'Sabarmati', 23.55, 72.62, {
    lvl: 1, st: ['rajasthan', 'gujarat'], rel: { flowsInto: 'gulf.gulf-of-khambhat' }, line: trace([24.45, 73.35], [22.3, 72.35]),
    f: ['Rises in the Aravalli hills of Udaipur district, Rajasthan.', 'Flows past Gandhinagar and Ahmedabad (Sabarmati Ashram) into the Gulf of Khambhat.'],
  }),
  P('river', 'Mahi', 23.25, 73.95, {
    lvl: 1, st: ['madhya-pradesh', 'rajasthan', 'gujarat'], rel: { flowsInto: 'gulf.gulf-of-khambhat' },
    f: ['Rises in the Vindhya range in Dhar district, Madhya Pradesh.', 'Crosses the Tropic of Cancer twice.', 'The Mahi Bajaj Sagar dam is at Banswara; it enters the Gulf of Khambhat.'],
  }),

  // ── Ganga system ────────────────────────────────────────────────────────
  P('river', 'Ganga', 25.32, 83.02, {
    lvl: 1, st: ['uttarakhand', 'uttar-pradesh', 'bihar', 'jharkhand', 'west-bengal'], aka: ['Ganges', 'Padma'],
    rel: { source: 'confluence.devprayag', flowsInto: 'sea.bay-of-bengal' },
    f: ['Formed at Devprayag where the Bhagirathi meets the Alaknanda; enters the plains at Haridwar.', 'Meets the Yamuna at Prayagraj; flows past Kanpur, Varanasi and Patna.', 'India’s national river (2008) and the Ganga river dolphin its national aquatic animal (2009).', 'Divides at Farakka: the Padma flows into Bangladesh, the Bhagirathi–Hooghly to Kolkata.'],
  }),
  P('river', 'Bhagirathi', 30.73, 78.45, {
    lvl: 1, st: ['uttarakhand'], rel: { source: 'glacier.gangotri', flowsInto: 'river.ganga' }, line: trace([30.93, 79.08], [30.15, 78.6]),
    f: ['Rises at Gaumukh, the snout of the Gangotri glacier.', 'Tehri dam, India’s tallest, is on the Bhagirathi.', 'Considered the source stream of the Ganga.'],
  }),
  P('river', 'Alaknanda', 30.35, 79.1, {
    lvl: 1, st: ['uttarakhand'], rel: { flowsInto: 'river.ganga' }, line: trace([30.78, 79.42], [30.15, 78.6]),
    f: ['Rises at the Satopanth and Bhagirath Kharak glaciers near Badrinath.', 'Its Panch Prayag: Vishnuprayag (Dhauliganga), Nandprayag (Nandakini), Karnaprayag (Pindar), Rudraprayag (Mandakini), Devprayag (Bhagirathi).', 'Carries more water than the Bhagirathi at Devprayag.'],
  }),
  P('river', 'Yamuna', 27.18, 78.02, {
    lvl: 1, st: ['uttarakhand', 'himachal-pradesh', 'haryana', 'delhi', 'uttar-pradesh'], rel: { tributaryOf: 'river.ganga', bank: 'right', source: 'glacier.yamunotri' },
    f: ['Rises at the Yamunotri glacier on the Bandarpunch massif.', 'Flows past Delhi, Mathura and Agra and joins the Ganga at the Triveni Sangam, Prayagraj.', 'The longest tributary of the Ganga; the Chambal, Sind, Betwa and Ken join it from the south.'],
  }),
  P('river', 'Hindon', 28.9, 77.55, {
    lvl: 3, st: ['uttar-pradesh'], rel: { tributaryOf: 'river.yamuna', bank: 'left' }, line: course([30.12, 77.85], [29.8, 77.75], [29.45, 77.7], [29.1, 77.6], [28.8, 77.5], [28.6, 77.43], [28.47, 77.47]),
    f: ['Rises in the Shivalik hills of Saharanpur district.', 'Flows past Ghaziabad and Noida into the Yamuna.'],
  }),
  P('river', 'Chambal', 25.2, 75.85, {
    lvl: 1, st: ['madhya-pradesh', 'rajasthan', 'uttar-pradesh'], aka: ['Charmanvati'], rel: { tributaryOf: 'river.yamuna', bank: 'right' },
    f: ['Rises in the Janapav hills near Mhow in the Vindhya.', 'Gandhi Sagar, Rana Pratap Sagar, Jawahar Sagar and the Kota barrage are on it.', 'Famous for its ravines (badlands) and the National Chambal Sanctuary for gharials.'],
  }),
  P('river', 'Banas', 25.95, 75.35, {
    lvl: 3, st: ['rajasthan'], aka: ['Van Ki Asha'], rel: { tributaryOf: 'river.chambal', bank: 'left' },
    f: ['Rises in the Aravalli near Kumbhalgarh and flows entirely in Rajasthan.', 'The Bisalpur dam, which supplies Jaipur, is on the Banas.'],
  }),
  P('river', 'Parbati', 24.9, 76.95, {
    lvl: 3, st: ['madhya-pradesh', 'rajasthan'], rel: { tributaryOf: 'river.chambal', bank: 'right' },
    f: ['A right-bank tributary of the Chambal draining the Malwa plateau.'],
  }),
  P('river', 'Betwa', 25.3, 78.6, {
    lvl: 1, st: ['madhya-pradesh', 'uttar-pradesh'], aka: ['Vetravati'], rel: { tributaryOf: 'river.yamuna', bank: 'right' },
    f: ['Rises in the Vindhya near Bhopal and joins the Yamuna at Hamirpur.', 'Orchha stands on its banks; the Rajghat and Matatila dams are on it.', 'The Ken–Betwa link is India’s first river-interlinking project.'],
  }),
  P('river', 'Ken', 24.75, 80.05, {
    lvl: 2, st: ['madhya-pradesh', 'uttar-pradesh'], aka: ['Karnavati'], rel: { tributaryOf: 'river.yamuna', bank: 'right' }, line: course([23.62, 80.3], [23.9, 80.1], [24.25, 79.95], [24.6, 80.0], [24.9, 80.1], [25.2, 80.25], [25.48, 80.33], [25.78, 80.52]),
    f: ['Flows through Panna Tiger Reserve and Bundelkhand; famous for its shajar stones.', 'Joins the Yamuna at Chilla in Banda district.', 'Source river for the Ken–Betwa link.'],
  }),
  P('river', 'Son', 24.55, 82.9, {
    lvl: 1, st: ['madhya-pradesh', 'uttar-pradesh', 'bihar'], rel: { tributaryOf: 'river.ganga', bank: 'right', source: 'plateau.amarkantak' },
    f: ['Rises at Amarkantak and is the largest southern tributary of the Ganga.', 'Bansagar dam is on the Son; the Rihand joins it.', 'Joins the Ganga near Patna.'],
  }),
  P('river', 'Gomti', 26.85, 80.95, {
    lvl: 1, st: ['uttar-pradesh'], rel: { tributaryOf: 'river.ganga', bank: 'left' }, line: trace([28.6, 80.07]),
    f: ['Rises at Gomat Taal near Madho Tanda, Pilibhit.', 'Lucknow and Jaunpur stand on the Gomti.', 'Joins the Ganga at Kaithi near Saidpur, Ghazipur.'],
  }),
  P('river', 'Ramganga', 28.35, 79.35, {
    lvl: 2, st: ['uttarakhand', 'uttar-pradesh'], rel: { tributaryOf: 'river.ganga', bank: 'left' }, line: trace([30.05, 79.22]),
    f: ['Rises in the Dudatoli hills of Uttarakhand and flows through Corbett National Park (Kalagarh dam).', 'Flows past Moradabad and Bareilly and joins the Ganga near Kannauj.'],
  }),
  P('river', 'Sharda', 28.9, 80.25, {
    lvl: 2, st: ['uttarakhand', 'uttar-pradesh'], aka: ['Kali', 'Mahakali'], rel: { tributaryOf: 'river.ghaghara', bank: 'right' }, line: trace([30.2, 80.93]),
    f: ['Called the Kali or Mahakali in the hills, where it forms the India–Nepal border.', 'The Mahakali Treaty (1996) covers the Pancheshwar project.', 'Joins the Ghaghara in Bahraich district.'],
  }),
  P('river', 'Ghaghara', 26.8, 82.2, {
    lvl: 1, st: ['uttar-pradesh', 'bihar'], aka: ['Karnali', 'Saryu'], rel: { tributaryOf: 'river.ganga', bank: 'left' },
    f: ['Rises near Manasarovar as the Karnali and flows through Nepal.', 'Known as the Saryu at Ayodhya.', 'Joins the Ganga near Chhapra, Bihar.'],
  }),
  P('river', 'Rapti', 26.8, 83.35, {
    lvl: 2, st: ['uttar-pradesh'], rel: { tributaryOf: 'river.ghaghara', bank: 'left' }, line: trace([28.1, 82.85]),
    f: ['Rises in Nepal and flows past Gorakhpur, causing frequent floods in eastern UP.', 'Joins the Ghaghara at Barhaj.'],
  }),
  P('river', 'Gandak', 26.95, 84.25, {
    lvl: 1, st: ['uttar-pradesh', 'bihar'], aka: ['Narayani', 'Kali Gandaki'], rel: { tributaryOf: 'river.ganga', bank: 'left' },
    f: ['Called the Kali Gandaki in Nepal, where it cuts one of the world’s deepest gorges.', 'Enters India at Valmikinagar (Valmiki Tiger Reserve) and joins the Ganga opposite Patna.'],
  }),
  P('river', 'Kosi', 26.2, 86.9, {
    lvl: 1, st: ['bihar'], aka: ['Sapt Kosi'], rel: { tributaryOf: 'river.ganga', bank: 'left' },
    f: ['Formed in Nepal by seven streams, including the Arun from Tibet.', 'Called the “Sorrow of Bihar” for its floods and shifting course.', 'Joins the Ganga near Kursela.'],
  }),
  P('river', 'Damodar', 23.6, 86.85, {
    lvl: 1, st: ['jharkhand', 'west-bengal'], rel: { tributaryOf: 'river.hooghly', bank: 'right' }, line: course([23.72, 84.72], [23.66, 85.1], [23.63, 85.52], [23.73, 85.85], [23.78, 86.2], [23.72, 86.55], [23.68, 86.75], [23.55, 87.1], [23.48, 87.3], [23.25, 87.8], [22.95, 87.95], [22.6, 88.02], [22.3, 88.08]),
    f: ['Rises in the Chota Nagpur plateau and flows east through a rift valley rich in coal.', 'Once the “Sorrow of Bengal”; the Damodar Valley Corporation (1948) was India’s first multipurpose river project.', 'Tilaiya, Konar, Maithon and Panchet dams are in its basin.'],
  }),
  P('river', 'Hooghly', 22.6, 88.3, {
    lvl: 1, st: ['west-bengal'], aka: ['Bhagirathi–Hooghly'], rel: { distributaryOf: 'river.ganga', flowsInto: 'sea.bay-of-bengal' },
    line: course([24.8, 87.93], [24.47, 88.07], [24.1, 88.25], [23.8, 88.3], [23.41, 88.37], [23.0, 88.4], [22.57, 88.34], [22.2, 88.18], [21.65, 88.05]),
    f: ['A distributary of the Ganga, fed by the Farakka feeder canal.', 'Kolkata and Haldia ports lie on it.'],
  }),
  P('river', 'Subarnarekha', 22.5, 86.8, {
    lvl: 2, st: ['jharkhand', 'west-bengal', 'odisha'], rel: { flowsInto: 'sea.bay-of-bengal' }, line: trace([23.33, 85.2], [21.58, 87.4]),
    f: ['Rises near Ranchi; the Hundru falls are on it.', 'Flows past Jamshedpur and reaches the Bay of Bengal between West Bengal and Odisha.'],
  }),

  // ── West-flowing rivers of the peninsula ────────────────────────────────
  P('river', 'Narmada', 22.72, 77.7, {
    lvl: 1, st: ['madhya-pradesh', 'maharashtra', 'gujarat'], aka: ['Rewa'], rel: { source: 'plateau.amarkantak', flowsInto: 'gulf.gulf-of-khambhat' },
    f: ['Rises at Amarkantak and flows west through a rift valley between the Vindhya and Satpura.', 'The largest west-flowing river of the peninsula; forms an estuary at Bharuch.', 'Dhuandhar falls, Indira Sagar, Omkareshwar and Sardar Sarovar dams are on it.'],
  }),
  P('river', 'Tapi', 21.3, 75.2, {
    lvl: 1, st: ['madhya-pradesh', 'maharashtra', 'gujarat'], aka: ['Tapti'], rel: { flowsInto: 'gulf.gulf-of-khambhat' },
    f: ['Rises near Multai in the Satpura range (Betul district).', 'Flows west in a rift valley parallel to the Narmada; Surat stands at its mouth.', 'The Ukai dam is on the Tapi; the Purna is its main tributary.'],
  }),
  P('river', 'Mandovi', 15.5, 74.0, {
    lvl: 2, st: ['karnataka', 'goa'], aka: ['Mhadei'], rel: { flowsInto: 'sea.arabian-sea' }, line: course([15.63, 74.38], [15.6, 74.2], [15.54, 74.04], [15.52, 73.93], [15.5, 73.83]),
    f: ['Rises at Bhimgad in Karnataka; Dudhsagar falls are on it.', 'Panaji stands on its estuary; the Mhadei water dispute involves Goa, Karnataka and Maharashtra.'],
  }),
  P('river', 'Sharavathi', 14.2, 74.75, {
    lvl: 2, st: ['karnataka'], rel: { flowsInto: 'sea.arabian-sea' }, line: course([13.88, 75.18], [14.02, 75.02], [14.15, 74.86], [14.23, 74.81], [14.26, 74.62], [14.28, 74.45]),
    f: ['Plunges 253 m at Jog Falls.', 'Linganamakki reservoir feeds the Sharavathi hydroelectric project; it meets the sea at Honnavar.'],
  }),
  P('river', 'Netravati', 12.85, 75.15, {
    lvl: 3, st: ['karnataka'], rel: { flowsInto: 'sea.arabian-sea' }, line: trace([13.12, 75.38]),
    f: ['Rises near Kudremukh and reaches the sea at Mangaluru.'],
  }),
  P('river', 'Periyar', 9.95, 76.8, {
    lvl: 1, st: ['kerala'], rel: { flowsInto: 'lake.vembanad' }, line: course([9.42, 77.3], [9.53, 77.14], [9.7, 77.02], [9.84, 76.97], [10.0, 76.8], [10.1, 76.55], [10.11, 76.35], [10.18, 76.22]),
    f: ['The longest river of Kerala, rising in the Sivagiri hills.', 'Mullaperiyar and Idukki dams are in its basin; Periyar Tiger Reserve surrounds its lake.', 'Reaches the sea near Kochi.'],
  }),
  P('river', 'Bharathapuzha', 10.78, 76.3, {
    lvl: 3, st: ['tamil-nadu', 'kerala'], aka: ['Nila'], rel: { flowsInto: 'sea.arabian-sea' }, line: course([10.58, 76.95], [10.76, 76.68], [10.8, 76.4], [10.8, 76.15], [10.78, 75.92]),
    f: ['Kerala’s second-longest river; flows through the Palghat Gap and reaches the sea at Ponnani.'],
  }),

  // ── East-flowing rivers of the peninsula ────────────────────────────────
  P('river', 'Mahanadi', 21.45, 83.9, {
    lvl: 1, st: ['chhattisgarh', 'odisha'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises in the Sihawa hills of Dhamtari district, Chhattisgarh.', 'Hirakud, one of the world’s longest earthen dams, is at Sambalpur.', 'Forms a large delta around Cuttack and reaches the sea near Paradip.'],
  }),
  P('river', 'Brahmani', 21.0, 85.3, {
    lvl: 2, st: ['odisha'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Formed by the Sankh and South Koel at Vedvyas near Rourkela.', 'Meets the Baitarani near the sea at Dhamra; the Bhitarkanika mangroves lie in the combined delta.'],
  }),
  P('river', 'Baitarani', 21.3, 86.1, {
    lvl: 3, st: ['odisha'], rel: { flowsInto: 'sea.bay-of-bengal' }, line: trace([21.55, 85.55]),
    f: ['Rises in the Gonasika hills of Keonjhar.', 'Joins the Brahmani delta near Dhamra.'],
  }),
  P('river', 'Godavari', 19.1, 77.3, {
    lvl: 1, st: ['maharashtra', 'telangana', 'chhattisgarh', 'andhra-pradesh'], aka: ['Dakshin Ganga'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises at Trimbakeshwar near Nashik; the longest river of the peninsula (about 1,465 km).', 'Called the Dakshin Ganga; its basin is the largest in peninsular India.', 'Tributaries: Pravara, Manjra (right); Penganga, Wardha, Wainganga, Indravati, Sabari (left).', 'Polavaram project and the Dowleswaram barrage are near its delta.'],
  }),
  P('river', 'Manjra', 18.35, 77.2, {
    lvl: 3, st: ['maharashtra', 'karnataka', 'telangana'], rel: { tributaryOf: 'river.godavari', bank: 'right' }, line: course([18.98, 75.45], [18.7, 75.9], [18.45, 76.5], [18.3, 77.1], [18.2, 77.6], [18.2, 77.93], [18.5, 77.95], [18.83, 77.85]),
    f: ['Rises in the Balaghat range near Beed; Nizam Sagar dam is on it.'],
  }),
  P('river', 'Wardha', 20.25, 79.05, {
    lvl: 2, st: ['madhya-pradesh', 'maharashtra'], rel: { tributaryOf: 'river.wainganga' }, line: trace([21.8, 78.3]),
    f: ['Rises in the Satpura range near Multai.', 'Joins the Wainganga to form the Pranhita.'],
  }),
  P('river', 'Wainganga', 21.3, 79.85, {
    lvl: 2, st: ['madhya-pradesh', 'maharashtra'], rel: { tributaryOf: 'river.godavari', bank: 'left' },
    f: ['Rises in the Mahadeo hills of Seoni and flows through Pench.', 'With the Wardha it forms the Pranhita, which joins the Godavari at Kaleshwaram.'],
  }),
  P('river', 'Indravati', 19.1, 81.3, {
    lvl: 1, st: ['odisha', 'chhattisgarh', 'maharashtra'], rel: { tributaryOf: 'river.godavari', bank: 'left' },
    f: ['Rises in the Kalahandi hills of Odisha and flows through Bastar.', 'Chitrakote falls, the “Niagara of India”, are on it; Indravati Tiger Reserve lies along it.'],
  }),
  P('river', 'Sabari', 17.95, 81.45, {
    lvl: 3, st: ['odisha', 'chhattisgarh', 'andhra-pradesh'], aka: ['Kolab'], rel: { tributaryOf: 'river.godavari', bank: 'left' }, line: course([18.8, 82.85], [18.75, 82.55], [18.55, 82.2], [18.3, 81.8], [18.0, 81.55], [17.8, 81.4], [17.58, 81.27]),
    f: ['Called the Kolab in Odisha; joins the Godavari at Kunavaram.'],
  }),
  P('river', 'Krishna', 16.55, 79.2, {
    lvl: 1, st: ['maharashtra', 'karnataka', 'telangana', 'andhra-pradesh'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises at Mahabaleshwar in the Western Ghats.', 'Almatti, Srisailam and Nagarjuna Sagar dams and the Prakasam barrage at Vijayawada are on it.', 'Tributaries: Koyna, Ghataprabha, Malaprabha, Tungabhadra (right); Bhima, Musi, Munneru (left).'],
  }),
  P('river', 'Koyna', 17.45, 73.75, {
    lvl: 2, st: ['maharashtra'], rel: { tributaryOf: 'river.krishna', bank: 'right' }, line: course([17.93, 73.66], [17.75, 73.7], [17.55, 73.74], [17.4, 73.77], [17.33, 73.95], [17.29, 74.18]),
    f: ['Flows south from Mahabaleshwar; the Koyna dam supplies one of India’s largest hydroelectric stations.', 'The 1967 Koyna earthquake is linked to reservoir-induced seismicity.', 'Joins the Krishna at Karad (Preeti Sangam).'],
  }),
  P('river', 'Ghataprabha', 16.15, 74.9, {
    lvl: 3, st: ['maharashtra', 'karnataka'], rel: { tributaryOf: 'river.krishna', bank: 'right' }, line: course([15.97, 74.05], [16.05, 74.3], [16.17, 74.63], [16.17, 74.83], [16.2, 75.2], [16.25, 75.55], [16.25, 75.85]),
    f: ['The Gokak falls are on the Ghataprabha.'],
  }),
  P('river', 'Malaprabha', 15.85, 75.3, {
    lvl: 3, st: ['karnataka'], rel: { tributaryOf: 'river.krishna', bank: 'right' }, line: course([15.66, 74.25], [15.64, 74.51], [15.75, 74.85], [15.86, 75.08], [15.95, 75.3], [15.9, 75.6], [15.95, 75.82], [16.2, 76.06]),
    f: ['Badami, Aihole and Pattadakal lie in its valley; joins the Krishna at Kudalasangama.'],
  }),
  P('river', 'Bhima', 17.8, 75.5, {
    lvl: 2, st: ['maharashtra', 'karnataka'], aka: ['Chandrabhaga'], rel: { tributaryOf: 'river.krishna', bank: 'left' },
    f: ['Rises at Bhimashankar; Pandharpur stands on it (as the Chandrabhaga).', 'The Ujani dam is on the Bhima; it joins the Krishna near Raichur.'],
  }),
  P('river', 'Tungabhadra', 15.45, 76.45, {
    lvl: 1, st: ['karnataka', 'andhra-pradesh'], rel: { tributaryOf: 'river.krishna', bank: 'right', source: 'confluence.koodli' },
    f: ['Formed by the Tunga and Bhadra at Koodli near Shivamogga.', 'Hampi lies on its bank; the Tungabhadra dam is at Hosapete.', 'Joins the Krishna near Kurnool.'],
  }),
  P('river', 'Musi', 17.2, 78.9, {
    lvl: 3, st: ['telangana'], rel: { tributaryOf: 'river.krishna', bank: 'left' }, line: course([17.33, 77.9], [17.37, 78.2], [17.37, 78.47], [17.35, 78.75], [17.2, 79.1], [17.0, 79.4], [16.68, 79.63]),
    f: ['Hyderabad was founded on the Musi; Osman Sagar and Himayat Sagar are on its tributaries.'],
  }),
  P('river', 'Penner', 14.6, 79.0, {
    lvl: 2, st: ['karnataka', 'andhra-pradesh'], aka: ['Pennar', 'Uttara Pinakini'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises in the Nandi hills of Chikkaballapur, Karnataka.', 'Flows through the rain-shadow Rayalaseema and reaches the sea near Nellore.'],
  }),
  P('river', 'Palar', 12.75, 79.4, {
    lvl: 3, st: ['karnataka', 'andhra-pradesh', 'tamil-nadu'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['A seasonal river from the Nandi hills flowing past Vellore to the sea south of Chennai.'],
  }),
  P('river', 'Kaveri', 11.8, 77.8, {
    lvl: 1, st: ['karnataka', 'tamil-nadu'], aka: ['Cauvery', 'Dakshina Ganga'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises at Talakaveri in the Brahmagiri hills of Kodagu.', 'Krishna Raja Sagara and Mettur dams; Shivanasamudra and Hogenakkal falls; Srirangam island.', 'Tributaries: Hemavati, Kabini, Bhavani, Amaravati, Noyyal, Arkavathi.', 'Its delta is the “rice bowl” of Tamil Nadu; the Grand Anicut (Kallanai) dates from the 2nd century.'],
  }),
  P('river', 'Kolidam', 11.2, 79.5, {
    lvl: 3, st: ['tamil-nadu'], aka: ['Coleroon'], rel: { distributaryOf: 'river.kaveri' },
    f: ['The northern distributary of the Kaveri, branching at Srirangam.'],
  }),
  P('river', 'Kabini', 11.95, 76.4, {
    lvl: 3, st: ['kerala', 'karnataka'], aka: ['Kapila'], rel: { tributaryOf: 'river.kaveri', bank: 'right' }, line: trace([11.8, 75.95]),
    f: ['Rises in Wayanad and separates Nagarhole from Bandipur; joins the Kaveri at T. Narasipura.'],
  }),
  P('river', 'Bhavani', 11.35, 77.3, {
    lvl: 3, st: ['kerala', 'tamil-nadu'], rel: { tributaryOf: 'river.kaveri', bank: 'right' }, line: course([11.12, 76.45], [11.15, 76.65], [11.25, 76.85], [11.4, 76.95], [11.47, 77.12], [11.45, 77.4], [11.44, 77.68]),
    f: ['Rises in the Silent Valley; the Bhavanisagar dam is on it.'],
  }),
  P('river', 'Vaigai', 9.93, 78.12, {
    lvl: 2, st: ['tamil-nadu'], rel: { flowsInto: 'strait.palk-strait' }, line: trace([9.72, 77.38], [9.38, 78.95]),
    f: ['Rises in the Varusanad hills; Madurai stands on it.', 'Receives water diverted from the Periyar through the Mullaperiyar project.'],
  }),
  P('river', 'Tamirabarani', 8.7, 77.8, {
    lvl: 3, st: ['tamil-nadu'], rel: { flowsInto: 'gulf.gulf-of-mannar' }, line: trace([8.6, 77.25]),
    f: ['Tamil Nadu’s only perennial river, rising at Agasthyamalai; Tirunelveli stands on it.'],
  }),

  // ── Brahmaputra and the Northeast ───────────────────────────────────────
  P('river', 'Brahmaputra', 26.2, 91.75, {
    lvl: 1, st: ['arunachal-pradesh', 'assam'], aka: ['Yarlung Tsangpo', 'Siang', 'Jamuna'], rel: { source: 'glacier.chemayungdung', flowsInto: 'sea.bay-of-bengal' },
    f: ['Rises at the Chemayungdung glacier near Manasarovar as the Yarlung Tsangpo.', 'Takes a great bend around Namcha Barwa and enters Arunachal as the Siang (Dihang).', 'Becomes the Brahmaputra near Sadiya where the Dibang and Lohit join; Majuli is its river island.', 'In Bangladesh it is the Jamuna and joins the Padma.'],
  }),
  P('river', 'Siang', 28.0, 95.15, {
    lvl: 2, st: ['arunachal-pradesh'], aka: ['Dihang'], geom: 'river:siang-dihang', rel: { flowsInto: 'river.brahmaputra' },
    f: ['The Yarlung Tsangpo becomes the Siang where it enters India at Gelling.'],
  }),
  P('river', 'Dibang', 28.25, 95.75, {
    lvl: 3, st: ['arunachal-pradesh'], aka: ['Talon'], rel: { tributaryOf: 'river.brahmaputra', bank: 'left' }, line: trace([28.85, 95.7]),
    f: ['Joins near Sadiya; the Dibang multipurpose project is set to be India’s tallest dam.'],
  }),
  P('river', 'Lohit', 27.9, 96.3, {
    lvl: 2, st: ['arunachal-pradesh', 'assam'], rel: { tributaryOf: 'river.brahmaputra', bank: 'left' },
    f: ['Enters India from Tibet near Kibithu; Parshuram Kund is on it.', 'The Dhola–Sadiya (Bhupen Hazarika) bridge crosses it.'],
  }),
  P('river', 'Subansiri', 27.55, 94.0, {
    lvl: 2, st: ['arunachal-pradesh', 'assam'], rel: { tributaryOf: 'river.brahmaputra', bank: 'right' }, line: trace([28.35, 93.15]),
    f: ['The largest tributary of the Brahmaputra; rises in Tibet.', 'The Subansiri Lower project is one of India’s largest hydroelectric schemes.'],
  }),
  P('river', 'Kameng', 27.3, 92.55, {
    lvl: 3, st: ['arunachal-pradesh', 'assam'], aka: ['Jia Bharali'], rel: { tributaryOf: 'river.brahmaputra', bank: 'right' }, line: trace([27.8, 92.35]),
    f: ['Separates Pakke and Nameri tiger reserves; joins the Brahmaputra near Tezpur.'],
  }),
  P('river', 'Manas', 26.6, 90.95, {
    lvl: 2, st: ['assam'], rel: { tributaryOf: 'river.brahmaputra', bank: 'right' }, line: trace([27.55, 90.9]),
    f: ['Flows from Bhutan through Manas National Park, a World Heritage Site.'],
  }),
  P('river', 'Dhansiri', 26.3, 93.85, {
    lvl: 3, st: ['nagaland', 'assam'], rel: { tributaryOf: 'river.brahmaputra', bank: 'left' }, line: trace([25.65, 94.05]),
    f: ['Rises at Laisang peak in Nagaland and flows past Golaghat.'],
  }),
  P('river', 'Teesta', 27.2, 88.5, {
    lvl: 1, st: ['sikkim', 'west-bengal'], aka: ['Tista'], rel: { tributaryOf: 'river.brahmaputra', bank: 'right' },
    f: ['Rises at the Tso Lhamo (Cholamu) lake in north Sikkim.', 'The lifeline of Sikkim; flows past Jalpaiguri into Bangladesh.', 'Sharing its water is a long-running India–Bangladesh issue.'],
  }),
  P('river', 'Barak', 24.83, 92.8, {
    lvl: 2, st: ['manipur', 'assam'], line: course([25.38, 94.05], [25.15, 93.85], [24.85, 93.6], [24.5, 93.35], [24.24, 93.02], [24.5, 93.05], [24.8, 93.1], [24.83, 92.78], [24.87, 92.36], [24.88, 92.25]),
    f: ['Rises in the Manipur hills near Senapati; Silchar stands on it.', 'In Bangladesh it splits into the Surma and Kushiyara, which form the Meghna.'],
  }),
  P('river', 'Kaladan', 22.4, 92.95, {
    lvl: 3, st: ['mizoram'], aka: ['Chhimtuipui'], rel: { flowsInto: 'sea.bay-of-bengal' },
    f: ['Flows from Mizoram through Myanmar to Sittwe.', 'The Kaladan Multi-Modal Transit Project links Kolkata to Mizoram through Sittwe port.'],
  }),
]
