import * as stylex from '@stylexjs/stylex'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@dfragon/ui/tokens.css'
import '@dfragon/ui/foundation.css'
import {
  Button,
  CardFrame,
  Checkbox,
  Chip,
  ContentStack,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  Kbd,
  Menu,
  NumericText,
  ProgressCircle,
  Select,
  StatusChip,
  SupportingText,
  Switch,
  Tabs,
  TextField,
  TextFieldInput,
  Tooltip,
  type CardFrameState
} from '@dfragon/ui'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const styles = stylex.create({
  page: {
    boxSizing: 'border-box',
    maxWidth: 960,
    marginInline: 'auto',
    padding: space.s24,
    backgroundColor: colors.bgCanvas,
    color: colors.fgDefault
  },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.s8 },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: space.s16
  },
  card: { height: 96, padding: space.s12, justifyContent: 'space-between' },
  label: { display: 'inline-flex', alignItems: 'center', gap: space.s8, fontSize: 14 }
})

const servers = [
  { value: 'cain', label: '카인' },
  { value: 'diregie', label: '디레지에' },
  { value: 'siroco', label: '시로코' },
  { value: 'prey', label: '프레이' }
]

const cardStates: { state: CardFrameState; label: string }[] = [
  { state: 'default', label: '조회 완료' },
  { state: 'selected', label: '선택' },
  { state: 'failure', label: '검색 실패' },
  { state: 'waiting', label: '인식 대기' },
  { state: 'top', label: '상위' },
  { state: 'ranker', label: '랭커' }
]

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  )
}

function Examples() {
  const [name, setName] = useState('예시 이름')
  const [server, setServer] = useState<string | null>('siroco')
  const [mode, setMode] = useState('party')
  const [activation, setActivation] = useState('아직 실행하지 않았습니다.')
  const [light, setLight] = useState(false)

  return (
    <main {...stylex.props(styles.page)}>
      <ContentStack>
        <SupportingText>
          공용 Component를 중립 예시 내용으로 확인합니다. 동작은 Base UI가, 외형은 DFragon 디자인
          토큰이 맡습니다.
        </SupportingText>
        <div {...stylex.props(styles.row)}>
          <Switch
            aria-label="라이트 모드"
            checked={light}
            onCheckedChange={(checked) => {
              setLight(checked)
              document.documentElement.dataset.theme = checked ? 'light' : 'dark'
            }}
          />
          <SupportingText>라이트 모드</SupportingText>
        </div>
        <ExampleSection title="버튼의 변형과 상태">
          <div {...stylex.props(styles.row)}>
            <Button variant="primary" size="lg" onClick={() => setActivation('주 버튼 실행')}>
              주 버튼
            </Button>
            <Button onClick={() => setActivation('보조 버튼 실행')}>보조 버튼</Button>
            <Button variant="ghost" onClick={() => setActivation('면 없는 버튼 실행')}>
              면 없는 버튼
            </Button>
            <Button variant="danger" onClick={() => setActivation('위험 버튼 실행')}>
              위험 버튼
            </Button>
            <Button size="sm" disabled onClick={() => setActivation('비활성 실행')}>
              비활성
            </Button>
            <Button variant="primary" loading onClick={() => setActivation('진행 중 실행')}>
              진행 중
            </Button>
            <IconButton aria-label="설정" icon={<SettingsIcon />} />
          </div>
          <SupportingText>
            <output aria-live="polite">{activation}</output>
          </SupportingText>
          <SupportingText>
            loading은 클릭을 막지 않습니다. 중복 실행을 막으려면 disabled를 함께 씁니다.
          </SupportingText>
        </ExampleSection>
        <ExampleSection title="입력">
          <TextField
            label="표시 이름"
            description="도메인과 관계없는 예시 이름입니다."
            value={name}
            onValueChange={({ value }) => setName(value)}
          >
            <TextFieldInput />
          </TextField>
          <TextField
            label="오류 예시"
            invalid
            errorMessage="이름을 입력해 주세요."
            description="오류와 설명의 연결을 확인합니다."
          >
            <TextFieldInput />
          </TextField>
          <TextField label="비활성 예시" disabled value="변경할 수 없습니다.">
            <TextFieldInput />
          </TextField>
        </ExampleSection>
        <ExampleSection title="목록과 메뉴">
          <div {...stylex.props(styles.row)}>
            <Select.Root value={server} onValueChange={setServer} items={servers}>
              <Select.Trigger size="xs" aria-label="서버">
                <Select.Value />
              </Select.Trigger>
              <Select.Popup aria-label="서버">
                {servers.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Root>
            <Menu.Root>
              <Menu.Trigger render={<Button variant="ghost" />}>
                검색 {mode === 'party' ? '파티' : '공대'}
              </Menu.Trigger>
              <Menu.Popup aria-label="검색 방식">
                <Menu.RadioGroup value={mode} onValueChange={setMode}>
                  <Menu.RadioItem value="party" closeOnClick>
                    파티
                  </Menu.RadioItem>
                  <Menu.RadioItem value="raid" closeOnClick>
                    공대
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Root>
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger render={<Button size="sm" />}>설명 보기</Tooltip.Trigger>
                <Tooltip.Popup>짧은 설명입니다.</Tooltip.Popup>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        </ExampleSection>
        <ExampleSection title="탭과 선택">
          <Tabs.Root defaultValue="collection">
            <Tabs.List aria-label="예시 탭">
              <Tabs.Tab value="collection">수집</Tabs.Tab>
              <Tabs.Tab value="labeling">정답 입력</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="collection">
              <SupportingText>수집 패널</SupportingText>
            </Tabs.Panel>
            <Tabs.Panel value="labeling">
              <SupportingText>정답 입력 패널</SupportingText>
            </Tabs.Panel>
          </Tabs.Root>
          <div {...stylex.props(styles.row)}>
            <label {...stylex.props(styles.label)}>
              <Checkbox defaultChecked />
              크롭 저장
            </label>
            <Chip defaultPressed>원본</Chip>
            <Chip>파티 전처리</Chip>
          </div>
        </ExampleSection>
        <ExampleSection title="상태 표시">
          <div {...stylex.props(styles.row)}>
            <StatusChip tone="success">연결됨</StatusChip>
            <StatusChip tone="waiting">찾는 중</StatusChip>
            <StatusChip tone="danger">실패</StatusChip>
            <StatusChip tone="neutral">대기</StatusChip>
            <StatusChip tone="success" size="md">
              창 감지됨
            </StatusChip>
            <StatusChip tone="waiting" size="md">
              창 확인 중
            </StatusChip>
            <ProgressCircle size="24" aria-label="불러오는 중" />
            <ProgressCircle size="24" value={60} aria-label="60% 진행" />
            <Kbd>Alt</Kbd>
            <Kbd>R</Kbd>
          </div>
          <div {...stylex.props(styles.cards)}>
            {cardStates.map(({ state, label }) => (
              <CardFrame key={state} state={state} as="article" aria-label={label}>
                <div {...stylex.props(styles.card)}>
                  <SupportingText>{label}</SupportingText>
                  <NumericText value={125850} />
                </div>
              </CardFrame>
            ))}
          </div>
        </ExampleSection>
        <ExampleSection title="대화상자">
          <DialogRoot>
            <DialogTrigger render={<Button />}>입력한 값 보기</DialogTrigger>
            <DialogContent title="입력한 값" description="열기, 닫기, 키보드 focus를 확인합니다.">
              <DialogBody>
                <SupportingText>{name}</SupportingText>
              </DialogBody>
              <DialogFooter>
                <DialogAction variant="primary">확인</DialogAction>
              </DialogFooter>
            </DialogContent>
          </DialogRoot>
          <SupportingText>Escape나 닫기로 끝내면 여는 버튼으로 focus가 돌아옵니다.</SupportingText>
        </ExampleSection>
      </ContentStack>
    </main>
  )
}

const root = document.getElementById('root')
const isRootMissing = root == null
if (isRootMissing) {
  throw new Error('Example root is missing')
}
createRoot(root).render(
  <StrictMode>
    <Examples />
  </StrictMode>
)
