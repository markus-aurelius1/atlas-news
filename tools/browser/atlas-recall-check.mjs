/** Development integration: a real native recall answer updates persistence, mastery, XP and due reviews. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const base = process.argv[2] ?? 'http://127.0.0.1:4182/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(base + '#/atlas?place=in.pass.nathu-la')
  await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
  // Freeze only the question seed while opening the review; obtain its answer
  // from the real gazetteer/generator rather than guessing or changing grading.
  const answer = await page.evaluate(async () => {
    const at = Date.now()
    window.qaNow = Date.now
    Date.now = () => at
    const { loadAtlas } = await import('/src/atlas/data.ts')
    const { dayKey } = await import('/src/lib/time.ts')
    const { makeQuestion } = await import('/src/atlas/questions.ts')
    const atlas = await loadAtlas()
    const question = makeQuestion(atlas, atlas.byId.get('in.pass.nathu-la'), new Map(), `${dayKey(at)}:${at}:0`)
    return { prompt: question.prompt, labels: (question.order ?? [question.answer]).map(id => question.options.find(option => option.id === id).label), order: !!question.order }
  })
  await page.getByRole('button', { name: 'Test me', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Test me', exact: true })
  await dialog.getByRole('heading', { name: answer.prompt, exact: true }).waitFor()
  await page.evaluate(() => { Date.now = window.qaNow; delete window.qaNow })
  for (const label of answer.labels) await dialog.getByRole('group', { name: 'Recall answer' }).getByRole(answer.order ? 'button' : 'radio', { name: label, exact: answer.order }).click()
  if (answer.order) await dialog.getByRole('button', { name: 'Check order', exact: true }).click()
  await dialog.getByText('Correct', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'See results', exact: true }).click()
  await dialog.getByText('Familiar', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  await page.getByRole('application').waitFor()
  // Atlas consumes one-shot place parameters; reselect after the cold reload.
  await page.goto(base + '#/atlas?place=in.pass.nathu-la')
  await page.getByRole('heading', { name: 'Nathu La', exact: true }).waitFor()
  await page.getByText('Familiar', { exact: true }).waitFor()
  const history = await page.evaluate(async () => {
    const { db } = await import('/src/data/db.ts')
    const recalls = await db.recalls.toArray()
    const { loadAtlas } = await import('/src/atlas/data.ts')
    const { computeExploration } = await import('/src/atlas/useExploration.ts')
    const { dayKey, addDaysKey } = await import('/src/lib/time.ts')
    const ex = computeExploration(await loadAtlas(), recalls, [], dayKey(Date.now()))
    const nextDay = computeExploration(await loadAtlas(), recalls, [], addDaysKey(dayKey(Date.now()), 1))
    return { recalls, xp: ex.xp.total, mastery: ex.mastery.get('in.pass.nathu-la')?.level, dueTomorrow: nextDay.due.some(item => item.id === 'in.pass.nathu-la') }
  })
  assert.equal(history.recalls.length, 1)
  assert.equal(history.recalls[0].correct, 1)
  assert.equal(history.mastery, 'familiar')
  assert.equal(history.xp, 1)
  assert.equal(history.dueTomorrow, true)
  assert.deepEqual(errors, [])
  console.log('PASS native recall saved once, Familiar survives reload, +1 XP and next-day review; no console errors')
} finally { await browser.close() }
