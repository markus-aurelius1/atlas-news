/** Reviewed identity mappings only. Never guesses coordinates, changes source questions, or renames Atlas IDs. */
export default {
  schema: 'atlas-pyq-mappings/v1',
  aliases: [], // { mention, placeId, questionId?, reason, sourceUrl } resolves a documented identity only
  wikidata: [], // { mention, wikidataId, questionId?, reason, sourceUrl }
  ambiguousNames: ['nice', 'reading', 'bath', 'java', 'turkey', 'jordan', 'victoria', 'georgia', 'orange', 'mobile', 'bali', 'niger', 'salem', 'kota', 'swift', 'washington', 'lincoln', 'santa', 'krishna', 'ravi', 'rampur', 'bilaspur', 'aurangabad', 'santiago', 'sultanpur'],
}
