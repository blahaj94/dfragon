/// <reference types="vite/client" />
import dragonMark from '../../../resources/brand.png?inline'
import pretendard from '../../frontend/src/assets/fonts/PretendardVariable.woff2?inline'

// Inline assets keep the one-shot callback independent of any later HTTP request.
export const LOGIN_COMPLETE_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>로그인 완료</title>
    <link rel="icon" href="data:," />
    <style>
      @font-face {
        font-family: 'Pretendard Variable';
        src: url('${pretendard}') format('woff2');
        font-weight: 45 920;
        font-style: normal;
        font-display: swap;
      }
      body {
        margin: 0;
        background: #15171b;
        color: #f3f4f5;
        font-family: 'Pretendard Variable', Pretendard, sans-serif;
        word-break: keep-all;
        overflow-wrap: anywhere;
      }
      main {
        width: min(480px, calc(100% - 48px));
        margin: 96px auto 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        text-align: center;
      }
      img { width: 128px; height: 128px; object-fit: contain; }
      h1 { margin: 0; font-size: 32px; line-height: 42px; font-weight: 700; }
      p { margin: 0; color: #c7c9ce; font-size: 16px; line-height: 26px; }
    </style>
  </head>
  <body>
    <main>
      <img src="${dragonMark}" alt="DFragon 드래곤" />
      <h1>로그인 완료</h1>
      <p>이 탭을 닫아도 됩니다.</p>
    </main>
  </body>
</html>`
