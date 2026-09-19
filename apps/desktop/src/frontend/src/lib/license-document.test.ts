import { expect, it } from 'vitest'
import { licenseDocumentUrl } from './license-document'

it.each([
  ['http://localhost:5173/index.html', 'http://localhost:5173/notices/index.html'],
  [
    'file:///fixture/out/frontend/index.html?theme=dark',
    'file:///fixture/out/frontend/notices/index.html'
  ],
  [
    'file:///C:/Program%20Files/LDB/resources/app.asar/out/frontend/index.html',
    'file:///C:/Program%20Files/LDB/resources/licenses/index.html'
  ],
  [
    'file:///Applications/LDB.app/Contents/Resources/app.asar/out/frontend/index.html',
    'file:///Applications/LDB.app/Contents/Resources/licenses/index.html'
  ]
])('resolves offline notices for %s', (document, expected) => {
  expect(licenseDocumentUrl(document)).toBe(expected)
})
