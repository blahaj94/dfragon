import { mock } from 'node:test'

mock.timers.enable({ apis: ['Date'], now: Date.parse(process.env.FORMAT_DATE_TEST_NOW) })
