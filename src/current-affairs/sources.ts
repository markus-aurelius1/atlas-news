/**
 * Authoritative News allowlist. The original 39 endpoints returned usable RSS metadata on 2026-10-01.
 * The 38 additions come only from the curated UPSC/UPPCS shortlist and were live-probed twice through
 * this gateway's own request shape and parser on 2026-10-05; empty, dormant, RSS 1.0/RDF and redundant
 * candidates are excluded. Keep the registry below 100 sources and run `npm run news:probe` before adding.
 * Times of India feeds are personal-use only: never expose this gateway as a public syndication endpoint.
 */
import type { NewsItem, NewsSource } from './types.ts'
export const MAX_NEWS_SOURCES = 99
const source = (id: string, publisher: string, feedUrl: string, section: string, subjectHints: string[] = [], priority = 2, extra: Partial<Pick<NewsSource, 'kind' | 'siteUrl'>> = {}): NewsSource => ({ id, publisher, label: `${publisher} · ${section}`, feedUrl, siteUrl: extra.siteUrl ?? new URL(feedUrl).origin, kind: extra.kind ?? (publisher === 'Guardian' ? 'international' : 'newspaper'), section, subjectHints, priority, enabled: true })
/** International coverage ranks behind Indian newspapers when one event has several reports. */
const world = (id: string, publisher: string, feedUrl: string, section: string, subjectHints: string[] = [], siteUrl?: string) => source(id, publisher, feedUrl, section, subjectHints, 3, { kind: 'international', siteUrl })
/** Direct Substack publication feeds: only the metadata RSS exposes, never subscriber-only bodies. */
const letter = (id: string, publisher: string, feedUrl: string, subjectHints: string[] = []) => source(id, publisher, feedUrl, 'Newsletter', subjectHints, 3, { kind: 'newsletter' })
export const NEWS_SOURCES: NewsSource[] = [
  source('dte-news', 'Down To Earth', 'https://www.downtoearth.org.in/stories.rss', 'Environment & development', ['Environment']),
  source('ie-upsc', 'Indian Express', 'https://indianexpress.com/section/upsc-current-affairs/feed/', 'UPSC Current Affairs', [], 1),
  source('ie-explained', 'Indian Express', 'https://indianexpress.com/section/explained/feed/', 'Explained', [], 1),
  source('ie-economy', 'Indian Express', 'https://indianexpress.com/section/business/economy/feed/', 'Economy', ['Economy']),
  source('ie-india', 'Indian Express', 'https://indianexpress.com/section/india/feed/', 'India'),
  source('ie-world', 'Indian Express', 'https://indianexpress.com/section/world/feed/', 'World', ['International relations']),
  source('ie-governance', 'Indian Express', 'https://indianexpress.com/section/governance/feed/', 'Governance', ['Governance']),
  source('ie-editorial', 'Indian Express', 'https://indianexpress.com/section/opinion/editorials/feed/', 'Editorial'),
  source('hindu-national', 'The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss', 'National'),
  source('hindu-world', 'The Hindu', 'https://www.thehindu.com/news/international/feeder/default.rss', 'World', ['International relations']),
  source('hindu-economy', 'The Hindu', 'https://www.thehindu.com/business/Economy/feeder/default.rss', 'Economy', ['Economy']),
  source('hindu-science', 'The Hindu', 'https://www.thehindu.com/sci-tech/science/feeder/default.rss', 'Science', ['Sci-Tech']),
  source('hindu-environment', 'The Hindu', 'https://www.thehindu.com/sci-tech/energy-and-environment/feeder/default.rss', 'Environment', ['Environment']),
  source('hindu-editorial', 'The Hindu', 'https://www.thehindu.com/opinion/editorial/feeder/default.rss', 'Editorial'),
  source('mint-economy', 'Mint', 'https://www.livemint.com/rss/economy', 'Economy', ['Economy']),
  source('mint-politics', 'Mint', 'https://www.livemint.com/rss/politics', 'Politics'),
  source('mint-science', 'Mint', 'https://www.livemint.com/rss/science', 'Science', ['Sci-Tech']),
  source('mint-opinion', 'Mint', 'https://www.livemint.com/rss/opinion', 'Opinion'),
  source('ht-india', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml', 'India'),
  source('ht-world', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml', 'World', ['International relations']),
  source('ht-explained', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/ht-explainers/rssfeed.xml', 'Explained', [], 1),
  source('ht-science', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/science/rssfeed.xml', 'Science', ['Sci-Tech']),
  source('ht-business', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/business/rssfeed.xml', 'Business', ['Economy']),
  source('ht-editorial', 'Hindustan Times', 'https://www.hindustantimes.com/feeds/rss/editorials/rssfeed.xml', 'Editorial'),
  source('bs-economy', 'Business Standard', 'https://www.business-standard.com/rss/economy-102.rss', 'Economy', ['Economy']),
  source('bs-india', 'Business Standard', 'https://www.business-standard.com/rss/india-news-216.rss', 'India'),
  source('bs-world', 'Business Standard', 'https://www.business-standard.com/rss/world-news-221.rss', 'World', ['International relations']),
  source('bl-economy', 'BusinessLine', 'https://www.thehindubusinessline.com/economy/feeder/default.rss', 'Economy', ['Economy']),
  source('bl-agriculture', 'BusinessLine', 'https://www.thehindubusinessline.com/economy/agri-business/feeder/default.rss', 'Agriculture', ['Economy']),
  source('bl-national', 'BusinessLine', 'https://www.thehindubusinessline.com/news/national/feeder/default.rss', 'National'),
  source('bl-science', 'BusinessLine', 'https://www.thehindubusinessline.com/news/science/feeder/default.rss', 'Science', ['Sci-Tech']),
  source('bl-editorial', 'BusinessLine', 'https://www.thehindubusinessline.com/opinion/editorial/feeder/default.rss', 'Editorial'),
  source('tribune-india', 'The Tribune', 'https://publish.tribuneindia.com/newscategory/india/feed/', 'India'),
  source('tribune-world', 'The Tribune', 'https://publish.tribuneindia.com/newscategory/world/feed/', 'World', ['International relations']),
  source('tribune-business', 'The Tribune', 'https://publish.tribuneindia.com/newscategory/business/feed/', 'Business', ['Economy']),
  source('tribune-editorial', 'The Tribune', 'https://publish.tribuneindia.com/opinions/editorials/feed/', 'Editorial'),
  source('guardian-world', 'Guardian', 'https://www.theguardian.com/world/rss', 'World', ['International relations'], 3),
  source('guardian-environment', 'Guardian', 'https://www.theguardian.com/uk/environment/rss', 'Environment', ['Environment'], 3),
  source('guardian-science', 'Guardian', 'https://www.theguardian.com/science/rss', 'Science', ['Sci-Tech'], 3),
  source('toi-india', 'Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms', 'India'),
  source('toi-world', 'Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'World', ['International relations']),
  source('toi-business', 'Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', 'Business', ['Economy']),
  source('toi-environment', 'Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/2647163.cms', 'Environment', ['Environment']),
  source('toi-science', 'Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/-2128672765.cms', 'Science', ['Sci-Tech']),
  // The only state-level Uttar Pradesh feed on the shortlist; retained for UPPCS although the publisher updates it rarely.
  source('et-uttarpradesh', 'Economic Times', 'https://b2b.economictimes.indiatimes.com/rss/uttarpradesh', 'Uttar Pradesh', ['Governance']),
  source('india-frontline-cover-story', 'Frontline', 'https://frontline.thehindu.com/cover-story/feeder/default.rss', 'Cover story'),
  source('india-india-today-india', 'India Today', 'https://www.indiatoday.in/rss/1206578', 'India'),
  source('india-ndtv-latest', 'NDTV', 'https://feeds.feedburner.com/NDTV-LatestNews', 'Latest', [], 2, { siteUrl: 'https://www.ndtv.com' }),
  source('india-northeast-now', 'Northeast Now', 'https://nenow.in/feed', 'Northeast India'),
  source('india-scroll-in', 'Scroll.in', 'https://feeds.feedburner.com/ScrollinArticles.rss', 'Latest', [], 2, { siteUrl: 'https://scroll.in' }),
  world('ext-bbc-world', 'BBC', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'World', ['International relations'], 'https://www.bbc.co.uk'),
  world('ext-bbc-business', 'BBC', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'Business', ['Economy'], 'https://www.bbc.co.uk'),
  world('ext-bbc-science-environment', 'BBC', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'Science & environment', ['Sci-Tech', 'Environment'], 'https://www.bbc.co.uk'),
  world('ext-al-jazeera', 'Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'World', ['International relations']),
  world('ext-scmp', 'South China Morning Post', 'https://www.scmp.com/rss/91/feed/', 'World', ['International relations']),
  world('ext-politico-europe', 'Politico Europe', 'https://www.politico.eu/feed/', 'Europe', ['International relations']),
  world('ext-economist-world-this-week', 'The Economist', 'https://www.economist.com/the-world-this-week/rss.xml', 'The world this week', ['International relations']),
  world('ext-economist-finance-economics', 'The Economist', 'https://www.economist.com/finance-and-economics/rss.xml', 'Finance & economics', ['Economy']),
  world('ext-financial-times', 'Financial Times', 'https://www.ft.com/rss/home/international', 'International', ['Economy']),
  world('ext-bloomberg-markets', 'Bloomberg', 'https://www.bloomberg.com/feeds/markets/news.rss', 'Markets', ['Economy']),
  world('ext-nasa-news-releases', 'NASA', 'https://www.nasa.gov/news-release/feed/', 'News releases', ['Sci-Tech']),
  world('nyt-world', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'World', ['International relations'], 'https://www.nytimes.com'),
  world('nyt-asia-pacific', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', 'Asia Pacific', ['International relations'], 'https://www.nytimes.com'),
  world('nyt-middle-east', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'Middle East', ['International relations'], 'https://www.nytimes.com'),
  world('nyt-russia-ukraine-war', 'New York Times', 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/news-event/ukraine-russia/rss.xml', 'Russia–Ukraine war', ['International relations']),
  world('nyt-economy', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', 'Economy', ['Economy'], 'https://www.nytimes.com'),
  world('nyt-climate', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', 'Climate', ['Environment'], 'https://www.nytimes.com'),
  world('nyt-science', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', 'Science', ['Sci-Tech'], 'https://www.nytimes.com'),
  world('nyt-artificial-intelligence', 'New York Times', 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/spotlight/artificial-intelligence/rss.xml', 'Artificial intelligence', ['Sci-Tech']),
  letter('substack-the-economist-off-the-charts', 'The Economist: Off the Charts', 'https://theeconomistoffthecharts.substack.com/feed', ['Economy']),
  letter('substack-gentle-leviathan', 'Gentle Leviathan', 'https://gentleleviathan.substack.com/feed', ['Governance', 'Economy']),
  letter('substack-the-quantified-india', 'The Quantified India', 'https://thequantifiedindia.substack.com/feed', ['Economy']),
  letter('substack-future-of-india', 'Future of India', 'https://foifaction.substack.com/feed', ['Economy']),
  letter('substack-people-policies-progress-pib-india', 'People, Policies, Progress — PIB India', 'https://pibindia.substack.com/feed', ['Governance']),
  letter('substack-india-politics-power-public-discourse', 'India: Politics, Power & Public Discourse', 'https://rgupta.substack.com/feed', ['Governance']),
  letter('substack-political-economy-stats-and-society', 'Political Economy, Stats, and Society', 'https://statsandsociety.substack.com/feed', ['Economy']),
  letter('substack-anticipating-the-unintended', 'Anticipating the Unintended', 'https://publicpolicy.substack.com/feed', ['Governance', 'International relations']),
]
const enabled = new Set(NEWS_SOURCES.filter(s => s.enabled).map(s => s.id))
/** Old offline responses can contain removed official feeds; hide them without deleting personal URL state. */
export const activeFeedItems = (items: NewsItem[]) => items.filter(item => enabled.has(item.sourceId))
export const isActiveSource = (id: string) => enabled.has(id)
