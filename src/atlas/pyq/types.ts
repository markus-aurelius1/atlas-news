/** Separated canonical Atlas PYQs. Source exam/IDs are immutable; CDS evidence stays secondary. */
export type ExamCode = 'UPSC-CSE' | 'UPPCS' | 'CDS'
export type ExamFamily = 'CSE' | 'PCS' | 'CDS'
export type Relevance = 'direct-spatial' | 'place-centric' | 'spatial-association' | 'incidental' | 'none'
export type OptionKey = 'A' | 'B' | 'C' | 'D'
export interface CanonicalItem { label: string; delimiter: string; content: CanonicalBlock[] }
export interface Segment { kind: 'text' | 'reference'; value: string }
export type CanonicalBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'statement-list' | 'ordered-list' | 'unordered-list' | 'labelled-sections' | 'assertion-reason'; items: CanonicalItem[] }
  | { type: 'pairs'; items: Array<{ label: string; delimiter: string; left: string; separator: string; right: string; trailing?: string }> }
  | { type: 'table' | 'matching-table'; columns: string[]; rows: string[][]; header_separator?: string; row_separator?: string }
  | { type: 'matching-lists'; lists: Array<{ title: string; items: CanonicalItem[] }> }
  | { type: 'answer-code'; segments: Segment[]; mapping_labels: string[] }
  | { type: 'sequence'; segments: Segment[] }
export interface CanonicalQuestion {
  number: number
  type: 'mcq' | 'statements' | 'matching' | 'pairs' | 'sequence' | 'assertion-reason' | 'propositions' | 'table' | 'context' | 'quotation'
  structures: string[]
  content: CanonicalBlock[]
  options: Array<{ key: OptionKey; content: CanonicalBlock[] }>
}
export interface PlaceMention {
  questionId: string
  placeId: string
  mentionText: string
  locationInQuestion: 'stem' | 'statement' | 'table' | 'pair' | 'sequence' | 'option'
  path: string
  start: number
  end: number
  optionKey?: OptionKey
  semanticRole: 'primary' | 'supporting' | 'comparison' | 'distractor' | 'incidental'
  relevance: Relevance
  masteryEligible: boolean
  quizIncluded: boolean
  resolution: string
}
export interface CorpusIdentity {
  canonicalRelease: string
  canonicalSchema: 'canonical-pyq/v2'
  manifestHash: string
  packageHash: string
  pipelineVersion: string
  pipelineHash: string
  atlasDataVersion: number
  atlasHash: string
  atlasSourceHash: string
  mappingsHash: string
}
export interface AtlasPyqQuestion {
  schema: 'atlas-pyq-question/v1'
  id: string
  answerId: string
  exam: { code: ExamCode; name: string; stage: 'prelims'; paper: 'GS1' | 'GK'; year: number; cycle: 'I' | 'II' | null; corpus_role: 'primary' | 'secondary' }
  family: ExamFamily
  question: CanonicalQuestion
  relevance: Exclude<Relevance, 'incidental' | 'none'>
  baseQuestionHash: string
  relations: PlaceMention[]
}
export interface AtlasPyqAnswer { schema: 'atlas-pyq-answer/v1'; id: string; questionId: string; status: 'final'; correctOptions: OptionKey[]; suppliedAnswerHash: string }
export interface PaperEntry { paperId: string; exam: ExamCode; family: ExamFamily; year: number; cycle: 'I' | 'II' | null; corpusRole: 'primary' | 'secondary'; count: number; questions: string; answers: string; questionsHash: string; answersHash: string }
export interface AtlasPyqManifest { schema: 'atlas-pyq-manifest/v1'; identity: CorpusIdentity; count: number; byFamily: Record<ExamFamily, number>; examFamilies: Record<ExamCode, ExamFamily>; papers: PaperEntry[]; placeIndex: string; placeIndexHash: string }
export interface AtlasPyqPaper { schema: 'atlas-pyq-paper/v1'; identity: CorpusIdentity; paperId: string; questions: AtlasPyqQuestion[] }
export interface AtlasPyqAnswers { schema: 'atlas-pyq-answers/v1'; identity: CorpusIdentity; paperId: string; answers: AtlasPyqAnswer[] }
export interface PlacePyqIndex { schema: 'atlas-place-pyq-index/v1'; identity: CorpusIdentity; places: Record<string, { questionIds: string[]; byFamily: Record<ExamFamily, number>; primaryQuestionIds: string[]; enrichmentQuestionIds: string[] }> }
