# MVP 미리보기 자산

- `character.png`: 확정 Penpot 보드에서 가져온 던전앤파이터, 네오플 이미지입니다. 이미지 권리는 NEOPLE/NEXON에 있으며 합성 UI 검토를 위한 디자인 자산으로만 사용합니다. 원본 서비스는 https://img-api.neople.co.kr 입니다. 실제 사용자 이름, 캐릭터 식별자는 fixture 데이터에 포함하지 않습니다.
- `src/frontend/src/assets/fonts/x12y12pxMaruMinyaHangul.woff2`: 마루미냐 한글 저장소 https://github.com/quiple/x12y12pxMaruMinyaHangul/tree/main/fonts (commit `1d293b925ad8c2af0a5cbd06ca5a2547946712d6`) 의 원본입니다. SHA-256: `0eadea62cb264f19e741b87d3b89bf39cf15d49448c5ebb886575b95a2549505`. 글꼴 저작권은 Lee Minseo와 The x12y12pxMaruMinya Project Authors에 있으며 OFL 1.1을 따릅니다. 글꼴 자체를 유료 판매하지 않습니다. 전체 라이선스: `notices/desktop/MARUMINYA-LICENSE`; 출처: https://quiple.dev/font/maruminya-hangul .
- 카메라, 새 버전 Release 열기, 새로고침(`refresh-cw`) SVG는 Lucide 형태를 사용합니다. https://lucide.dev/icons ; `notices/desktop/LUCIDE-LICENSE`에 ISC와 Feather 파생 아이콘의 MIT 고지를 보존합니다.

캐릭터 이미지는 `mvp-preview` 전용 빌드에서만 포함됩니다. 공용 글꼴과 아이콘 고지는 기본 앱에도 포함됩니다. 실데이터 소비 시 고정 이미지 origin과 검증한 식별자에서 URL을 구성합니다.
