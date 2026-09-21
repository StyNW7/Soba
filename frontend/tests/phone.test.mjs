import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidPhone, normalizePhone } from '../src/lib/format.ts'

test('local Indonesian numbers become international', () => {
  assert.equal(normalizePhone('081297894752'), '+6281297894752')
  assert.equal(normalizePhone('0812 9789 4752'), '+6281297894752')
  assert.equal(normalizePhone('0812-9789-4752'), '+6281297894752')
  assert.equal(normalizePhone('6281297894752'), '+6281297894752')
})

test('numbers already in international form are left alone', () => {
  assert.equal(normalizePhone('+6281297894752'), '+6281297894752')
  assert.equal(normalizePhone('+1 415 555 0123'), '+14155550123')
})

test('an ambiguous number is not given a country code', () => {
  assert.equal(normalizePhone('81297894752'), '81297894752')
  assert.equal(isValidPhone(normalizePhone('81297894752')), false)
})

test('the contract pattern accepts what normalizing produces', () => {
  assert.equal(isValidPhone(normalizePhone('081297894752')), true)
  assert.equal(isValidPhone(normalizePhone('abc')), false)
  assert.equal(isValidPhone(''), false)
})
