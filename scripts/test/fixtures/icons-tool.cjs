const { mkdir, writeFile } = require('node:fs/promises')
const { join } = require('node:path')

// 실제 이미지 변환은 실행하지 않고 builder의 파일 생성 경계만 재현한다.
exports.runIconsTool = async ({ inputFile, outputFormat, outDir }) => {
  const input = await require('node:fs/promises').readFile(inputFile, 'utf8')
  if (input !== '합성 브랜드 원본') {
    throw new Error('다른 입력 파일을 선택했습니다')
  }
  await mkdir(outDir, { recursive: true })
  const files = {
    ico: ['icon.ico'],
    icns: ['icon.icns'],
    set: ['512x512.png', '128x128.png', '64x64.png']
  }
  for (const file of files[outputFormat]) {
    await writeFile(join(outDir, file), `${outputFormat}/${file}`)
  }
  if (process.env.ICON_FAIL_FORMAT === outputFormat) {
    throw new Error('합성 변환 실패')
  }
}
