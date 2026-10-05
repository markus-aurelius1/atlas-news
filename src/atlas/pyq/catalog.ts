/** A shared, lazy catalogue: index metadata first, only selected papers after that. Failed requests are retryable. */
import { loadAtlasPyqManifest, loadAtlasPyqPaper, loadPlacePyqIndex } from './loaders'
import type { AtlasPyqManifest } from './types'
let catalog: ReturnType<typeof getNewCatalog> | undefined
const getNewCatalog = async () => { const manifest = await loadAtlasPyqManifest(); return { manifest, index: await loadPlacePyqIndex(manifest) } }
export function getPyqCatalog() {
  catalog ??= getNewCatalog()
  void catalog.catch(() => { catalog = undefined })
  return catalog
}
export const paperForQuestion = (id: string) => id.replace(/-Q\d+$/, '')
export async function getPyqQuestion(id: string, manifest: AtlasPyqManifest) {
  const pack = await loadAtlasPyqPaper(manifest, paperForQuestion(id))
  const question = pack.paper.questions.find((q) => q.id === id)
  const answer = pack.answers.answers.find((a) => a.questionId === id)
  if (!question || !answer) throw new Error('Question is outside the curated Atlas subset')
  return { question, answer }
}
