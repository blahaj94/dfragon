import type { NoticeEntry } from './collect.ts'

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]!
  )
}

/** Static HTML works offline under file:// and needs no scripts or privileged IPC. */
export function renderNotices(entries: NoticeEntry[], chromium: boolean): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'">
<title>오픈소스 라이선스</title><style>
:root { color-scheme: light dark; font: 14px/1.6 system-ui, sans-serif; }
body { margin: 0; padding: 16px; overflow-wrap: anywhere; }
h1 { font-size: 20px; margin: 0 0 8px; } p { margin: 0 0 16px; }
details { border: 1px solid #8888; border-radius: 8px; margin: 8px 0; }
summary { padding: 12px; cursor: pointer; font-weight: 600; }
summary:focus-visible { outline: 2px solid #3392ff; outline-offset: -2px; }
article { padding: 0 12px 12px; } h2 { font-size: 14px; }
pre { font: 12px/1.7 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
iframe { width: 100%; height: 65vh; border: 0; background: white; }
</style></head><body><h1>오픈소스 라이선스</h1>
<p>이 앱에 포함된 오픈소스와 자산의 저작권·라이선스 원문입니다. 항목을 펼쳐 확인할 수 있습니다.</p>
${entries.map((entry) => `<details><summary>${escapeHtml(entry.name)} ${escapeHtml(entry.version)} · ${escapeHtml(entry.license)}</summary><article>${entry.documents.map((document) => `<h2>${escapeHtml(document.name)}</h2><pre>${escapeHtml(document.text)}</pre>`).join('')}</article></details>`).join('\n')}
${chromium ? '<details><summary>Chromium 및 포함된 구성요소</summary><iframe title="Chromium 라이선스 원문" sandbox src="LICENSES.chromium.html"></iframe></details>' : ''}
</body></html>`
}
