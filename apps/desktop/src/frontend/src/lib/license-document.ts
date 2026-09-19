/** Packaged notices live outside ASAR so the packager can include target-specific Electron notices. */
export function licenseDocumentUrl(documentUrl: string): string {
  const url = new URL(documentUrl)
  const packaged = url.protocol === 'file:' && url.pathname.includes('/app.asar/')
  return new URL(packaged ? '../../../licenses/index.html' : './notices/index.html', url).href
}
