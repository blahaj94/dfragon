import { contextBridge } from 'electron'
import * as capture from './api/capture'
import * as search from './api/search'
import * as manualSearch from './api/manual-search'
import * as raidSearch from './api/raid-search'
import * as desktopShortcut from './api/desktop-shortcut'
import * as diagnostics from './api/diagnostics'
import * as updateNotice from './api/update-notice'
import * as windowChrome from './api/window-chrome'

contextBridge.exposeInMainWorld('api', capture)

contextBridge.exposeInMainWorld('search', search)

contextBridge.exposeInMainWorld('manualSearch', manualSearch)
contextBridge.exposeInMainWorld('raidSearch', raidSearch)

contextBridge.exposeInMainWorld('desktopShortcut', desktopShortcut)
contextBridge.exposeInMainWorld('diagnostics', diagnostics)
contextBridge.exposeInMainWorld('updateNotice', updateNotice)
contextBridge.exposeInMainWorld('windowChrome', windowChrome)
