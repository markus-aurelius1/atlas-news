/** Explicit canonical reference allowlist. Missing concepts have no reference; never synthesize search/page URLs. */
export const OFFICIAL_LINKS: Record<string, string> = {
  RBI: 'https://www.rbi.org.in/', SEBI: 'https://www.sebi.gov.in/', ECI: 'https://www.eci.gov.in/', CAG: 'https://cag.gov.in/',
  'Finance Commission': 'https://fincomindia.nic.in/', 'NITI Aayog': 'https://www.niti.gov.in/', ISRO: 'https://www.isro.gov.in/',
  'United Nations': 'https://www.un.org/', IMF: 'https://www.imf.org/', 'World Bank': 'https://www.worldbank.org/', WTO: 'https://www.wto.org/', WHO: 'https://www.who.int/',
  'Ramsar Convention': 'https://www.ramsar.org/', 'Climate change': 'https://unfccc.int/',
  'Ministry of Finance': 'https://finmin.gov.in/', 'Ministry of External Affairs': 'https://www.mea.gov.in/', 'Ministry of Environment': 'https://moef.gov.in/',
  'Ministry of Agriculture': 'https://agriwelfare.gov.in/', 'Ministry of Defence': 'https://mod.gov.in/', 'Ministry of Home Affairs': 'https://www.mha.gov.in/',
}
export function referenceLinks(concept: string) {
  const url = Object.hasOwn(OFFICIAL_LINKS, concept) ? OFFICIAL_LINKS[concept] : undefined
  return url ? [{ concept, provider: 'Official', url }] : []
}
