import { serverNames } from './servers'

export const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))
