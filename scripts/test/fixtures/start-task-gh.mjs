#!/usr/bin/env node

process.stdout.write(process.env.START_TASK_ISSUE ?? '')
process.exitCode = Number(process.env.START_TASK_GH_EXIT ?? '0')
