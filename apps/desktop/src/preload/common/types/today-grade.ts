export const TODAY_GRADE_CHANNELS = {
  read: 'getTodayGrade'
} as const

export type TodayGrade = Readonly<{
  percent: number
  expiresAt: string
}>

export interface TodayGradeIPCFunctions {
  getTodayGrade: () => Promise<TodayGrade>
}

export type TodayGradeApi = TodayGradeIPCFunctions
