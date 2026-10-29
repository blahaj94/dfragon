import { ipcRenderer } from 'electron'
import { parseTodayGrade } from '../common/today-grade'
import { TODAY_GRADE_CHANNELS, type TodayGradeApi } from '../common/types/today-grade'

export const getTodayGrade: TodayGradeApi['getTodayGrade'] = async () => {
  const grade = parseTodayGrade(await ipcRenderer.invoke(TODAY_GRADE_CHANNELS.read))
  if (grade == null) {
    throw new Error('INVALID_TODAY_GRADE_RESPONSE')
  }

  return grade
}
