// TypeScript가 side-effect import의 모듈 해석을 검사하므로 esbuild가 번들하는 stylesheet를 모듈로 선언한다.
declare module '*.css'
