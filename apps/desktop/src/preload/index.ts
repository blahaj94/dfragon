import { contextBridge } from 'electron'
import * as capture from './api/capture'
import * as auth from './api/auth'
import * as search from './api/search'
import * as manualSearch from './api/manual-search'
import * as developer from './api/developer'
import * as versions from './api/versions'
import * as desktopShortcut from './api/desktop-shortcut'
import * as ocrCollection from './api/ocr-collection'
import * as diagnostics from './api/diagnostics'
import * as updateNotice from './api/update-notice'

contextBridge.exposeInMainWorld('api', capture)
contextBridge.exposeInMainWorld('auth', auth)

contextBridge.exposeInMainWorld('search', search)

contextBridge.exposeInMainWorld('manualSearch', manualSearch)

contextBridge.exposeInMainWorld('developer', developer)

contextBridge.exposeInMainWorld('versions', versions)

contextBridge.exposeInMainWorld('desktopShortcut', desktopShortcut)
contextBridge.exposeInMainWorld('ocrCollection', ocrCollection)
contextBridge.exposeInMainWorld('diagnostics', diagnostics)
contextBridge.exposeInMainWorld('updateNotice', updateNotice)
