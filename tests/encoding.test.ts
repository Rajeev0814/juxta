import { describe, expect, it } from 'vitest'
import { decodeText, detectEncoding, detectEol } from '../src/core/encoding'
import { convertEol } from '../src/shared/eol'

describe('detectEncoding', () => {
  it('detects plain UTF-8', () => {
    expect(detectEncoding(Buffer.from('hello', 'utf8'))).toEqual({ encoding: 'utf8', bomLength: 0 })
  })
  it('detects UTF-8 BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('hi', 'utf8')])
    expect(detectEncoding(buf)).toEqual({ encoding: 'utf8-bom', bomLength: 3 })
  })
  it('detects UTF-16 LE / BE via BOM', () => {
    expect(detectEncoding(Buffer.from([0xff, 0xfe, 0x68, 0x00])).encoding).toBe('utf16le')
    expect(detectEncoding(Buffer.from([0xfe, 0xff, 0x00, 0x68])).encoding).toBe('utf16be')
  })
  it('detects BOM-less UTF-16 LE from null-byte parity', () => {
    // "hi" in UTF-16 LE without BOM: 68 00 69 00
    expect(detectEncoding(Buffer.from([0x68, 0x00, 0x69, 0x00])).encoding).toBe('utf16le')
  })
})

describe('decodeText', () => {
  it('decodes UTF-16 LE bytes to text', () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('héllo', 'utf16le')])
    expect(decodeText(buf)).toBe('héllo')
  })
  it('strips a UTF-8 BOM', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('abc', 'utf8')])
    expect(decodeText(buf)).toBe('abc')
  })
  it('round-trips UTF-16 BE', () => {
    // "Hi" UTF-16 BE: 00 48 00 69
    const buf = Buffer.from([0xfe, 0xff, 0x00, 0x48, 0x00, 0x69])
    expect(decodeText(buf)).toBe('Hi')
  })
})

describe('detectEol', () => {
  it('classifies LF / CRLF / mixed / none', () => {
    expect(detectEol('a\nb\nc')).toBe('lf')
    expect(detectEol('a\r\nb\r\nc')).toBe('crlf')
    expect(detectEol('a\r\nb\nc')).toBe('mixed')
    expect(detectEol('abc')).toBe('none')
  })
})

describe('convertEol', () => {
  it('converts to CRLF and to LF, normalizing mixed input', () => {
    expect(convertEol('a\nb', 'crlf')).toBe('a\r\nb')
    expect(convertEol('a\r\nb', 'lf')).toBe('a\nb')
    expect(convertEol('a\r\nb\nc\rd', 'lf')).toBe('a\nb\nc\nd')
    expect(convertEol('a\r\nb\nc', 'crlf')).toBe('a\r\nb\r\nc')
  })
  it('is idempotent', () => {
    expect(convertEol(convertEol('a\nb', 'crlf'), 'crlf')).toBe('a\r\nb')
  })
})
