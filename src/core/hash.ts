import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'

export interface HashOptions {
  ignoreWhitespace: boolean
  ignoreCase: boolean
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
  if (!options.ignoreWhitespace && !options.ignoreCase) {
    return hashFileRaw(filePath)
  }
  const buf = await readFile(filePath)
  let text = buf.toString('utf8')
  if (options.ignoreWhitespace) text = normalizeText(text)
  if (options.ignoreCase) text = text.toLowerCase()
  return createHash('sha1').update(text).digest('hex')
}
