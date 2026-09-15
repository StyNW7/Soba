import test from 'node:test'
import assert from 'node:assert/strict'
import { completeWeeks, trendRange } from '../src/api/dates.ts'
test('guardian pulse covers exactly two completed Monday-to-Monday weeks', () => {
  assert.equal(
    completeWeeks(2, new Date(2026, 8, 12)),
    'from=2026-08-24&to=2026-09-07',
  )
  assert.equal(
    completeWeeks(2, new Date(2026, 8, 14)),
    'from=2026-08-31&to=2026-09-14',
  )
})
test('guardian trends cover whole weeks across year boundaries', () => {
  assert.equal(
    completeWeeks(4, new Date(2026, 0, 4)),
    'from=2025-12-01&to=2025-12-29',
  )
})
test('personal trends include today with an exclusive end date', () => {
  assert.equal(
    trendRange(new Date(2026, 8, 12)),
    'from=2026-08-14&to=2026-09-13',
  )
})
