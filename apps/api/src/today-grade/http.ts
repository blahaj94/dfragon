import { ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ApiTodayGrade } from '../swagger/operations.js'
import { respondWithCancellation } from '../http-response.js'
import type { TodayGradeService } from './service.js'

export const TODAY_GRADE_SERVICE = Symbol('TODAY_GRADE_SERVICE')

@ApiTags('아이템')
@Controller('items')
export class TodayGradeController {
  constructor(@Inject(TODAY_GRADE_SERVICE) private readonly service: TodayGradeService) {}

  @Get('today-grade')
  @ApiTodayGrade()
  async todayGrade(@Res() response: Response): Promise<void> {
    await respondWithCancellation(response, (signal) => this.service.get(signal))
  }
}
