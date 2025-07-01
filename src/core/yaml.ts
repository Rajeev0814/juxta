// Canonicalize YAML so two files that differ only in formatting, indentation,
// quoting style or mapping key order compare as identical. Sequence order is
// preserved (semantically significant), mirroring the JSON canonicalizer.
// Returns null when the text isn't valid YAML.
import { parseAllDocuments } from 'yaml'
import { sortKeys, type Json } from './json'

export function canonicalizeYaml(text: string): string | null {
  let docs: ReturnType<typeof parseAllDocuments>
  try {
    docs = parseAllDocuments(text)
  } catch {
    return null
  }
  if (docs.length === 0) return null
  const parts: string[] = []
  for (const doc of docs) {
    if (doc.errors.length > 0) return null
    // toJS() turns the YAML tree into plain JS; canonicalize like JSON so a
    // YAML doc and its JSON equivalent normalize the same way.
    const value = doc.toJS() as Json
    parts.push(JSON.stringify(sortKeys(value)))
  }
  return parts.join('\n---\n')
}
