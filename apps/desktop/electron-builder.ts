import { readChannelNameFromEnvironment } from './build/channels'
import { createBuilderConfig } from './build/electron-builder-config'

export default createBuilderConfig(readChannelNameFromEnvironment())
