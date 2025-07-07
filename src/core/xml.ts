// Canonicalize XML so two documents that differ only in formatting/indentation,
// insignificant whitespace or attribute order compare as identical. Parsed into
// a plain object (attributes under an "@_" prefix), then keys are sorted and
// emitted as canonical JSON — mirroring the JSON/YAML canonicalizers. Returns
// null when the text isn't well-formed XML.
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { sortKeys, type Json } from './json'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false
})

export function canonicalizeXml(text: string): string | null {
  if (XMLValidator.validate(text) !== true) return null
  let parsed: unknown
  try {
    parsed = parser.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  return JSON.stringify(sortKeys(parsed as Json))
}
