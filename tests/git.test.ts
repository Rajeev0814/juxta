import { describe, expect, it } from 'vitest'
import { gitDiffToolCommands, gitMergeToolCommands, parseGitDiffArgs, parseGitMergeArgs } from '../src/shared/git'

describe('parseGitDiffArgs', () => {
  it('extracts the two paths after --git-diff', () => {
    expect(parseGitDiffArgs(['C:/Juxta.exe', '--git-diff', '/tmp/a', '/tmp/b'])).toEqual({
      left: '/tmp/a',
      right: '/tmp/b'
    })
  })
  it('returns null when the flag is absent or incomplete', () => {
    expect(parseGitDiffArgs(['Juxta.exe', '/tmp/a', '/tmp/b'])).toBeNull()
    expect(parseGitDiffArgs(['Juxta.exe', '--git-diff', '/only-one'])).toBeNull()
  })
})

describe('gitDiffToolCommands', () => {
  it('builds git config lines with the exe and LOCAL/REMOTE placeholders', () => {
    const out = gitDiffToolCommands('C:\\Apps\\Juxta\\Juxta.exe')
    expect(out).toContain('git config --global diff.tool juxta')
    expect(out).toContain('C:/Apps/Juxta/Juxta.exe') // backslashes -> forward
    expect(out).toContain('--git-diff "$LOCAL" "$REMOTE"')
  })
})

describe('parseGitMergeArgs', () => {
  it('extracts base/local/remote/merged', () => {
    expect(parseGitMergeArgs(['Juxta.exe', '--git-merge', 'b', 'l', 'r', 'm'])).toEqual({
      base: 'b',
      local: 'l',
      remote: 'r',
      merged: 'm'
    })
  })
  it('returns null when incomplete', () => {
    expect(parseGitMergeArgs(['Juxta.exe', '--git-merge', 'b', 'l', 'r'])).toBeNull()
  })
})

describe('gitMergeToolCommands', () => {
  it('builds merge config with BASE/LOCAL/REMOTE/MERGED placeholders', () => {
    const out = gitMergeToolCommands('C:\\Juxta.exe')
    expect(out).toContain('git config --global merge.tool juxta')
    expect(out).toContain('--git-merge "$BASE" "$LOCAL" "$REMOTE" "$MERGED"')
  })
})
