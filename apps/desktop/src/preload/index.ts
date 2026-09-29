import { contextBridge } from 'electron'
import * as capture from './api/capture'
import * as auth from './api/auth'
import * as search from './api/search'
import * as manualSearch from './api/manual-search'
import * as developer from './api/developer'
import * as versions from './api/versions'

contextBridge.exposeInMainWorld('api', capture)
contextBridge.exposeInMainWorld('auth', auth)

contextBridge.exposeInMainWorld('search', search)

contextBridge.exposeInMainWorld('manualSearch', manualSearch)

contextBridge.exposeInMainWorld('developer', developer)

contextBridge.exposeInMainWorld('versions', versions)
