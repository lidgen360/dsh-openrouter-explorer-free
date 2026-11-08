/**
 * OpenRouter credit balance for the «Едем на халяву» block.
 *
 * The website shows the balance on its credits page; the public API exposes the
 * same numbers for a Bearer key: `GET /api/v1/credits` →
 * `{ data: { total_credits: number, total_usage: number } }`.
 *
 * The plugin never touches payments: the top-up button is a plain link to the
 * OpenRouter website, so money never moves through this plugin.
 */

/** Credits endpoint for the configured API base. */
export function creditsUrl(baseURL) {
  const base = String(baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  return `${base}/credits`
}

/**
 * Normalize the credits payload; missing numbers stay `null` so the UI can show
 * «—» instead of a fake zero. Accepts snake_case and camelCase spellings.
 */
export function normalizeCredits(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {}
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload
  const number = (value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const totalCredits = number(data.total_credits ?? data.totalCredits)
  const totalUsage = number(data.total_usage ?? data.totalUsage)
  const remaining = totalCredits !== null && totalUsage !== null ? totalCredits - totalUsage : null
  return { total_credits: totalCredits, total_usage: totalUsage, remaining }
}
