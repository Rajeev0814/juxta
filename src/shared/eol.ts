/** Convert all line endings in text to the target style (renderer-safe, pure). */
export function convertEol(text: string, target: 'lf' | 'crlf'): string {
  const lf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return target === 'crlf' ? lf.replace(/\n/g, '\r\n') : lf
}
