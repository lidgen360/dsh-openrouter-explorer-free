/**
 * Unit tests for the balance adapter: the credits payload is small but the API
 * has been seen with both snake_case and camelCase spellings.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { creditsUrl, normalizeCredits } from '../src/host/balance.js'

test('normalizeCredits reads the documented payload', () => {
  assert.deepEqual(normalizeCredits({ data: { total_credits: 20, total_usage: 7.5 } }), {
    total_credits: 20,
    total_usage: 7.5,
    remaining: 12.5,
  })
})

test('normalizeCredits accepts camelCase, flat payloads and missing numbers', () => {
  assert.deepEqual(normalizeCredits({ totalCredits: '10', totalUsage: '3' }), {
    total_credits: 10,
    total_usage: 3,
    remaining: 7,
  })
  assert.deepEqual(normalizeCredits({ data: { total_credits: 5 } }), {
    total_credits: 5,
    total_usage: null,
    remaining: null,
  })
  assert.deepEqual(normalizeCredits({}), { total_credits: null, total_usage: null, remaining: null })
  assert.deepEqual(normalizeCredits(null), { total_credits: null, total_usage: null, remaining: null })
})

test('normalizeCredits keeps a negative remainder instead of clamping it', () => {
  assert.deepEqual(normalizeCredits({ data: { total_credits: 2, total_usage: 5 } }), {
    total_credits: 2,
    total_usage: 5,
    remaining: -3,
  })
})

test('creditsUrl follows the configured API base', () => {
  assert.equal(creditsUrl('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1/credits')
  assert.equal(creditsUrl('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1/credits')
  assert.equal(creditsUrl(''), 'https://openrouter.ai/api/v1/credits')
  assert.equal(creditsUrl(undefined), 'https://openrouter.ai/api/v1/credits')
})
