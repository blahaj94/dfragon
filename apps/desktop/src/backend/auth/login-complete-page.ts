/// <reference types="vite/client" />
import dragonMark from '../../../resources/brand.png?inline'
import maruMinya from '../../frontend/src/assets/fonts/x12y12pxMaruMinyaHangul.woff2?inline'

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
        font-family: 'MaruMinya Hangul';
        src: url('${maruMinya}') format('woff2');
        font-weight: 100 900;
        font-style: normal;
        font-display: swap;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f0f11;
        color: #f1ede6;
        font-family: 'MaruMinya Hangul', 'Malgun Gothic', sans-serif;
        word-break: keep-all;
        overflow-wrap: anywhere;
      }
      main {
        position: relative;
        width: min(480px, calc(100% - 32px));
        box-sizing: border-box;
        padding: 40px 32px;
        background: #17171a;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .bracket {
        position: absolute;
        width: 12px;
        height: 12px;
        border: 0 solid #3dd68c;
      }
      .top-left { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
      .top-right { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
      .bottom-left { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
      .bottom-right { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }
      .mark {
        width: 160px;
        height: 160px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #121214;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
        background-size: 24px 24px;
      }
      img { width: 128px; height: 128px; object-fit: contain; }
      h1 {
        margin: 24px 0 0;
        font-size: 28px;
        line-height: 36px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      p { margin: 12px 0 0; color: #ada9a2; font-size: 15px; line-height: 24px; }
    </style>
  </head>
  <body>
    <main>
      <span class="bracket top-left" aria-hidden="true"></span>
      <span class="bracket top-right" aria-hidden="true"></span>
      <span class="bracket bottom-left" aria-hidden="true"></span>
      <span class="bracket bottom-right" aria-hidden="true"></span>
      <div class="mark">
        <img src="${dragonMark}" alt="DFragon 드래곤" />
      </div>
      <h1>로그인 완료</h1>
      <p>이 탭을 닫아도 됩니다.</p>
    </main>
  </body>
</html>`
