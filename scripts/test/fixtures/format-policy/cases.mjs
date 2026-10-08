// 문자열 안의 원문 공백과 독립 기대값을 그대로 보존한다. 각 호출은 새 사례 객체와 배열을 만든다.
export function createSpacingCases() {
  return [
    {
      name: '블록 첫 return 앞에는 빈 줄을 넣지 않는다',
      source: 'function f(){return 1}',
      expected: 'function f() {\n  return 1\n}\n'
    },
    {
      name: '블록 첫 bare return 앞에는 빈 줄을 넣지 않는다',
      source: 'function f(){return;}',
      expected: 'function f() {\n  return\n}\n'
    },
    {
      name: '블록 첫 return 앞의 기존 빈 줄은 제거한다',
      source: 'function f(){\n\n\nreturn 1}',
      expected: 'function f() {\n  return 1\n}\n'
    },
    {
      name: '빈 문장은 블록 첫 return 앞에 빈 줄을 만들지 않는다',
      source: 'function f(){;;;return 1}',
      expected: 'function f() {\n  return 1\n}\n'
    },
    {
      name: '화살표 함수 블록 첫 return 앞에는 빈 줄을 넣지 않는다',
      source: 'const f=()=>{return 1}',
      expected: 'const f = () => {\n  return 1\n}\n'
    },
    {
      name: 'directive 뒤 return 앞에는 빈 줄을 둔다',
      source: 'function f(){"use strict";return 1}',
      expected: "function f() {\n  'use strict'\n\n  return 1\n}\n"
    },
    {
      name: '바깥 문장은 중첩 블록 첫 return의 간격을 바꾸지 않는다',
      source: 'function f(x){work();if(x){return 1}return 2}',
      expected: 'function f(x) {\n  work()\n  if (x) {\n    return 1\n  }\n\n  return 2\n}\n'
    },
    {
      name: 'try catch finally 블록 첫 return 앞에는 빈 줄을 넣지 않는다',
      source: 'function f(){try{return 1}catch{return 2}finally{return 3}}',
      expected:
        'function f() {\n  try {\n    return 1\n  } catch {\n    return 2\n  } finally {\n    return 3\n  }\n}\n'
    },
    {
      name: '앞에 다른 문장이 있으면 return 앞에 빈 줄을 둔다',
      source: 'function f(){work();return 1}',
      expected: 'function f() {\n  work()\n\n  return 1\n}\n'
    },
    {
      name: 'return 앞의 여러 빈 줄은 한 줄로 수렴한다',
      source: 'function f(){work()\n\n\nreturn 1}',
      expected: 'function f() {\n  work()\n\n  return 1\n}\n'
    },
    {
      name: 'directive 뒤 빈 문장을 제거해도 return 앞의 빈 줄을 유지한다',
      source: 'function f(){"use strict";\n\n;return 1}',
      expected: "function f() {\n  'use strict'\n\n  return 1\n}\n"
    },
    {
      name: 'if와 else 블록 첫 return의 간격을 유지한다',
      source: 'function f(x){if(x){return 1}else{return 2}}',
      expected: 'function f(x) {\n  if (x) {\n    return 1\n  } else {\n    return 2\n  }\n}\n'
    },
    {
      name: '블록 없는 분기의 return은 Biome 배치를 유지한다',
      source: 'function f(x){if(x)return 1;else return 2}',
      expected: 'function f(x) {\n  if (x) return 1\n  else return 2\n}\n'
    },
    {
      name: 'case의 첫 return과 중첩 case 블록의 첫 return 앞에는 빈 줄을 넣지 않는다',
      source: 'function f(x){switch(x){case 1:return 1;default:{return 2}}}',
      expected:
        'function f(x) {\n  switch (x) {\n    case 1:\n      return 1\n    default: {\n      return 2\n    }\n  }\n}\n'
    },
    {
      name: 'case 안에서 앞 문장이 있으면 return 앞에 빈 줄을 둔다',
      source: 'function f(x){switch(x){case 1:work();return 1}}',
      expected:
        'function f(x) {\n  switch (x) {\n    case 1:\n      work()\n\n      return 1\n  }\n}\n'
    },
    {
      name: 'label에 붙은 return은 Biome 배치를 유지한다',
      source: 'function f(){done:return 1}',
      expected: 'function f() {\n  done: return 1\n}\n'
    },
    {
      name: '블록 첫 return 앞의 한 줄 주석 위치를 유지한다',
      source: 'function f(){\n// reason\nreturn 1}',
      expected: 'function f() {\n  // reason\n  return 1\n}\n'
    },
    {
      name: '블록 첫 return과 같은 줄의 블록 주석을 유지한다',
      source: 'function f(){/* reason */ return 1}',
      expected: 'function f() {\n  /* reason */ return 1\n}\n'
    },
    {
      name: '주석과 블록 첫 return 사이의 빈 줄은 한 줄로 유지한다',
      source: 'function f(){\n/* reason */\n\n\nreturn 1}',
      expected: 'function f() {\n  /* reason */\n\n  return 1\n}\n'
    },
    {
      name: '앞 문장 뒤 한 줄 주석과 return 사이에 빈 줄을 둔다',
      source: 'function f(){work()\n\n// reason\nreturn 1}',
      expected: 'function f() {\n  work()\n\n  // reason\n\n  return 1\n}\n'
    },
    {
      name: '이전 문장의 줄 끝 주석을 유지하며 return 앞에 빈 줄을 둔다',
      source: 'function f(){work(); // reason\nreturn 1}',
      expected: 'function f() {\n  work() // reason\n\n  return 1\n}\n'
    },
    {
      name: '반환식 안의 주석을 유지한다',
      source: 'function f(){return /* value */ 1}',
      expected: 'function f() {\n  return /* value */ 1\n}\n'
    },
    {
      name: 'ASI로 끝난 bare return 뒤의 개행을 유지한다',
      source: 'function f(){return\n(1)}',
      expected: 'function f() {\n  return\n  1\n}\n'
    },
    {
      name: '템플릿 문자열 안의 return과 공백을 보존한다',
      source: 'function f(){return `line\nreturn value\n\n  return other`}',
      expected: 'function f() {\n  return `line\nreturn value\n\n  return other`\n}\n'
    },
    {
      name: '연속된 블록 guard 사이에 빈 줄을 두고 각 첫 return의 간격을 유지한다',
      source: 'function f(management,phone){if(management){return 1}if(phone){return 2}return 3}',
      expected:
        'function f(management, phone) {\n  if (management) {\n    return 1\n  }\n\n  if (phone) {\n    return 2\n  }\n\n  return 3\n}\n'
    },
    {
      name: '연속된 블록 if 사이의 여러 빈 줄은 한 줄로 수렴한다',
      source: 'function f(a,b){if(a){one()}\n\n\nif(b){two()}}',
      expected: 'function f(a, b) {\n  if (a) {\n    one()\n  }\n\n  if (b) {\n    two()\n  }\n}\n'
    },
    {
      name: 'else if 연결을 유지하며 다음 독립 if 앞에 빈 줄을 둔다',
      source: 'function f(a,b,c){if(a){one()}else if(b){two()}else{three()}if(c){four()}}',
      expected:
        'function f(a, b, c) {\n  if (a) {\n    one()\n  } else if (b) {\n    two()\n  } else {\n    three()\n  }\n\n  if (c) {\n    four()\n  }\n}\n'
    },
    {
      name: '중첩 블록 if는 같은 문장 목록의 if 사이만 분리한다',
      source: 'function f(a,b,c){if(a){if(b){one()}if(c){two()}}if(b){three()}}',
      expected:
        'function f(a, b, c) {\n  if (a) {\n    if (b) {\n      one()\n    }\n\n    if (c) {\n      two()\n    }\n  }\n\n  if (b) {\n    three()\n  }\n}\n'
    },
    {
      name: '최상위의 연속된 블록 if 사이에 빈 줄을 둔다',
      source: 'if(first){one()}if(second){two()}',
      expected: 'if (first) {\n  one()\n}\n\nif (second) {\n  two()\n}\n'
    },
    {
      name: '두 번째 블록 if와 같은 줄의 블록 주석 앞에 빈 줄을 둔다',
      source: 'function f(a,b){if(a){one()}\n/* reason */ if(b){two()}}',
      expected:
        'function f(a, b) {\n  if (a) {\n    one()\n  }\n\n  /* reason */ if (b) {\n    two()\n  }\n}\n'
    },
    {
      name: '앞 블록 if와 주석 사이의 빈 줄로 연속된 블록 if를 구분한다',
      source: 'function f(a,b){if(a){one()}\n\n// reason\nif(b){two()}}',
      expected:
        'function f(a, b) {\n  if (a) {\n    one()\n  }\n\n  // reason\n  if (b) {\n    two()\n  }\n}\n'
    },
    {
      name: 'return 앞 biome-ignore 주석은 return에 붙여 두고 그 위에 빈 줄을 둔다',
      source:
        'function f(source){work()\n// biome-ignore lint/security/noGlobalEval: reason\nreturn eval(source)}',
      expected:
        'function f(source) {\n  work()\n\n  // biome-ignore lint/security/noGlobalEval: reason\n  return eval(source)\n}\n'
    },
    {
      name: '두 번째 블록 if 앞 biome-ignore 주석은 if에 붙여 두고 그 위에 빈 줄을 둔다',
      source:
        'function f(a,b){if(a){one()}\n// biome-ignore lint/suspicious/noDebugger: reason\nif(b){debugger}}',
      expected:
        'function f(a, b) {\n  if (a) {\n    one()\n  }\n\n  // biome-ignore lint/suspicious/noDebugger: reason\n  if (b) {\n    debugger\n  }\n}\n'
    },
    {
      name: '블록 if의 줄 끝 주석 위치를 유지한다',
      source: 'function f(a,b){if(a){one()} // first\nif(b){two()}}',
      expected:
        'function f(a, b) {\n  if (a) {\n    one()\n  } // first\n\n  if (b) {\n    two()\n  }\n}\n'
    }
  ]
}

export function createReturnRuntimeSources() {
  return [
    'function f(){return\n(1)}; f()',
    'function f(){return /* split\nline */ (1)}; f()',
    'function f(){return (\n{value: 1}\n)}; JSON.stringify(f())',
    'let count=0; function next(){count++;return count} function f(){return next() + next()}; [f(), count].join() ',
    'function f(){return `line\nreturn value\n\n  return other`}; f()',
    'function f(){done:return 1}; f()',
    'function f(x){switch(x){case 1:return ++x;default:{return x*2}}}; [f(1),f(3)].join()',
    'function f(){try{return 1}finally{return 2}}; f()'
  ]
}

export function createIfRuntimeSources() {
  return [
    'let trace=[]; function f(a,b){if(a){trace.push("first");return 1}if(b){trace.push("second");return 2}return 3}; [f(true,true),f(false,true),f(false,false),trace.join()].join("|")',
    'let n=0;if(false){n+=1}\n/* reason */\n\nif(true){n+=2};n',
    'let n=0;if(false){n+=1}\n// reason\nif(true){n+=2};n',
    'let n=0;if(false){n+=1}\n/* reason */ if(true){n+=2};n',
    'let n=0;if(true)if(false)n=1;else n=2;n',
    'let values=[];if(true){values.push(1)}\nif(true){(values.push(2))}values.join()',
    'function f(a,b){done:{if(a){return 1}if(b){return 2}}return 3};[f(true,true),f(false,true),f(false,false)].join()',
    'function f(a,b){switch(1){case 1:if(a){return 1}if(b){return 2}break}return 3};[f(true,true),f(false,true),f(false,false)].join()',
    'const text=`line\nif (value) {return value}\n\nreturn other`;let result=[];if(true){result.push(text)}if(false){result.push("other")}result.join()'
  ]
}

export function createExtensionSpacingCase() {
  const source = 'function f(a,b){if(a){return 1}\n/* reason */ if(b){return 2}return 3}'
  const expected =
    'function f(a, b) {\n  if (a) {\n    return 1\n  }\n\n  /* reason */ if (b) {\n    return 2\n  }\n\n  return 3\n}\n'

  return { source, expected }
}

export function createCliSpacingCase() {
  const source =
    'function f() {\n  work()\n  return 1\n}\n\nif (first) {\n  one()\n}\nif (second) {\n  two()\n}\n'
  const expected =
    'function f() {\n  work()\n\n  return 1\n}\n\nif (first) {\n  one()\n}\n\nif (second) {\n  two()\n}\n'

  return { source, expected }
}
