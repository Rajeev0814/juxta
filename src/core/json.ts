// Canonicalize JSON so two files that differ only in whitespace/indentation or
// object key order compare as identical. Array order is preserved (it's
// semantically significant). Returns null when the text isn't valid JSON.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const out: { [k: string]: Json } = {}
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key])
    return out
  }
  return value
}

export function canonicalizeJson(text: string): string | null {
  let parsed: Json
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  return JSON.stringify(sortKeys(parsed))
}
