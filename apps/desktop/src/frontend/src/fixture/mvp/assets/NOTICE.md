# MVP 미리보기 자산

- `character.png`: 확정 Penpot 보드에서 가져온 던전앤파이터, 네오플 이미지입니다. 이미지 권리는 NEOPLE/NEXON에 있으며 합성 UI 검토를 위한 디자인 자산으로만 사용합니다. 원본 서비스는 https://img-api.neople.co.kr 입니다. 실제 사용자 이름, 캐릭터 식별자는 fixture 데이터에 포함하지 않습니다.
- `item-18.png`부터 `item-32.png`: 던전앤파이터 클라이언트의 아이템 아이콘입니다(긍휼 속 자비의 상의, 칠흑의 정화 상의, 강림한 여우 서약, 영원불변의 행운 서약, 검은 질병의 멸룡검 발뭉, 숭고한 심판의 어깨, 명예로운 공경의 하의, 완전한 침묵의 벨트, 고요한 안식의 신발, 성스러운 믿음의 목걸이, 드러난 진실의 팔찌, 거룩한 희생의 반지, 초연한 청렴의 보조장비, 무결한 순수의 마법석, 강인한 절제의 귀걸이). 이미지 권리는 NEOPLE/NEXON에 있으며 카드 장비 면의 세트, 서약 그림, 기타 면과 상세 창의 장비 아이콘을 합성 UI로 검토하기 위한 디자인 자산으로만 사용합니다. 원본 서비스는 https://img-api.neople.co.kr 입니다.
- `src/frontend/src/assets/fonts/PretendardVariable.woff2`: Pretendard 1.3.9 npm 패키지 https://registry.npmjs.org/pretendard/-/pretendard-1.3.9.tgz 의 `dist/web/variable/woff2/PretendardVariable.woff2` 원본입니다. SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`. 글꼴 저작권은 Kil Hyung-jin에 있으며 OFL 1.1을 따릅니다. 글꼴 자체를 유료 판매하지 않습니다. 전체 라이선스: `notices/desktop/FONT-LICENSE`; 출처: https://github.com/orioncactus/pretendard .
- 카메라, 상세 열기, 새로고침(`refresh-cw`, 로그인 진행 표시에도 사용) SVG는 Lucide 형태를 사용합니다. https://lucide.dev/icons ; `notices/desktop/LUCIDE-LICENSE`에 ISC와 Feather 파생 아이콘의 MIT 고지를 보존합니다.

캐릭터, 아이템 이미지는 `mvp-preview` 전용 빌드에서만 포함됩니다. 공용 글꼴과 아이콘 고지는 기본 앱에도 포함됩니다. 실데이터 소비 시 고정 이미지 origin과 검증한 식별자에서 URL을 구성합니다.
