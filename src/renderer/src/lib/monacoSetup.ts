// Wire @monaco-editor/react to the locally bundled monaco-editor instead of the
// default CDN loader. A desktop app must work offline, and our CSP forbids
// loading scripts from a CDN. Workers are bundled via Vite's `?worker` imports
// (allowed by the `worker-src 'self' blob:` CSP directive).
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
}

// Custom diff themes: a *light* tint on the whole changed line, and a much
// *darker/stronger* highlight on the actual changed characters (the inline
// "main" diff), so the precise change stands out within a softly marked line.
monaco.editor.defineTheme('juxta-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'diffEditor.insertedLineBackground': '#3fb95014',
    'diffEditor.removedLineBackground': '#f8514914',
    'diffEditor.insertedTextBackground': '#3fb95073',
    'diffEditor.removedTextBackground': '#f8514973',
    'diffEditor.diagonalFill': '#ffffff12'
  }
})
monaco.editor.defineTheme('juxta-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'diffEditor.insertedLineBackground': '#22863a12',
    'diffEditor.removedLineBackground': '#cb242612',
    'diffEditor.insertedTextBackground': '#22863a66',
    'diffEditor.removedTextBackground': '#cb242666',
    'diffEditor.diagonalFill': '#00000012'
  }
})

export function juxtaTheme(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? 'juxta-dark' : 'juxta-light'
}

loader.config({ monaco })
