import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { canonicalizeJson } from './json'
import { canonicalizeCsv } from './csv'
import { canonicalizeYaml } from './yaml'
import { canonicalizeXml } from './xml'

export interface HashOptions {
  ignoreWhitespace: boolean
  ignoreCase: boolean
  /** Drop lines matching this regex before hashing (empty/invalid = no-op). */
  ignoreLinePattern?: string
  /** Drop blank (whitespace-only) lines before hashing. */
  ignoreBlankLines?: boolean
  /** Canonicalize .json files (sorted keys, no whitespace) before hashing. */
  normalizeJson?: boolean
  /** Canonicalize .csv/.tsv files (sort data rows) before hashing. */
  normalizeCsv?: boolean
  /** Canonicalize .yaml/.yml files (sorted keys, formatting-independent) before hashing. */
  normalizeYaml?: boolean
  /** Canonicalize .xml files (sorted keys/attrs, formatting-independent) before hashing. */
  normalizeXml?: boolean
}

/** Remove blank / whitespace-only lines. */
export function stripBlankLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n')
}

/** Remove lines matching the given regex. Invalid regex / empty -> unchanged. */
export function dropIgnoredLines(text: string, pattern: string | undefined): string {
  if (!pattern) return text
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return text
  }
  return text
    .split('\n')
    .filter((line) => !re.test(line))
    .join('\n')
}

/**
 * Collapse runs of whitespace to a single space and trim each line, so that
 * files differing only in indentation / trailing space hash identically.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .trim()
}

/**
 * Stream-hash a file by raw bytes. Used for the common case where no text
 * normalization is required — avoids loading the whole file into memory.
 */
export function hashFileRaw(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * Hash a file, applying whitespace / case normalization when requested. When
 * normalization is needed the file is read fully and treated as UTF-8 text.
 */
export async function hashFile(filePath: string, options: HashOptions): Promise<string> {
  const hasPattern = !!options.ignoreLinePattern
  const wantJson = !!options.normalizeJson && /\.json$/i.test(filePath)
  const wantYaml = !!options.normalizeYaml && /\.ya?ml$/i.test(filePath)
  const wantXml = !!options.normalizeXml && /\.xml$/i.test(filePath)
  const csvDelimiter = /\.tsv$/i.test(filePath) ? '\t' : /\.csv$/i.test(filePath) ? ',' : null
  const wantCsv = !!options.normalizeCsv && csvDelimiter !== null
  if (
    !options.ignoreWhitespace &&
    !options.ignoreCase &&
    !options.ignoreBlankLines &&
    !hasPattern &&
    !wantJson &&
    !wantYaml &&
    !wantXml &&
    !wantCsv
  ) {
    return hashFileRaw(filePath)
  }
  const buf = await readFile(filePath)
  let text = buf.toString('utf8')

  if (wantJson) {
    const canonical = canonicalizeJson(text)
    if (canonical !== null) {
      // Valid JSON: canonical form already removes formatting/key-order noise.
      const out = options.ignoreCase ? canonical.toLowerCase() : canonical
      return createHash('sha1').update(out).digest('hex')
    }
    // Not valid JSON — fall through to the regular normalizers.
  }

  if (wantYaml) {
    const canonical = canonicalizeYaml(text)
    if (canonical !== null) {
      const out = options.ignoreCase ? canonical.toLowerCase() : canonical
      return createHash('sha1').update(out).digest('hex')
    }
    // Not valid YAML — fall through to the regular normalizers.
  }

  if (wantXml) {
    const canonical = canonicalizeXml(text)
    if (canonical !== null) {
      const out = options.ignoreCase ? canonical.toLowerCase() : canonical
      return createHash('sha1').update(out).digest('hex')
    }
    // Not well-formed XML — fall through to the regular normalizers.
  }

  if (wantCsv && csvDelimiter !== null) {
    const canonical = canonicalizeCsv(text, { delimiter: csvDelimiter })
    const out = options.ignoreCase ? canonical.toLowerCase() : canonical
    return createHash('sha1').update(out).digest('hex')
  }

  if (hasPattern) text = dropIgnoredLines(text, options.ignoreLinePattern)
  if (options.ignoreBlankLines) text = stripBlankLines(text)
  if (options.ignoreWhitespace) text = normalizeText(text)
  if (options.ignoreCase) text = text.toLowerCase()
  return createHash('sha1').update(text).digest('hex')
}
