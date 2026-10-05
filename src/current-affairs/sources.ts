/** Newspaper-only allowlist. Every endpoint returned usable RSS metadata on 2026-10-01; failed probes are excluded. */
import type { NewsItem, NewsSource } from './types.ts'
const source = (id: string, publisher: string, feedUrl: string, section: string, subjectHints: string[] = [], priority = 2): NewsSource => ({ id, publisher, label: `${publisher} · ${section}`, feedUrl, siteUrl: new URL(feedUrl).origin, kind: publisher === 'Guardian' ? 'international' : 'newspaper', section, subjectHints, priority, enabled: true })
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
]
const enabled = new Set(NEWS_SOURCES.filter(s => s.enabled).map(s => s.id))
/** Old offline responses can contain removed official feeds; hide them without deleting personal URL state. */
export const activeFeedItems = (items: NewsItem[]) => items.filter(item => enabled.has(item.sourceId))
export const isActiveSource = (id: string) => enabled.has(id)
