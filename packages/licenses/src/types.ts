export interface NoticeEntry {
  name: string
  version: string
  license: string
  documents: { name: string; text: string }[]
}
