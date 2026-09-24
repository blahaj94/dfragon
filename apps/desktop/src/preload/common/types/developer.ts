export type DeveloperSettings = { enabled: boolean }

export type DeveloperSample = {
  id: string
  createdAt: string
  width: number
  height: number
  text: string | null
}

export type DeveloperFrame = { pngDataUrl: string; width: number; height: number }

export type DeveloperApi = {
  getSettings: () => Promise<DeveloperSettings>
  setEnabled: (enabled: boolean) => Promise<DeveloperSettings>
  listSamples: () => Promise<DeveloperSample[]>
  readImage: (id: string) => Promise<string>
  addSample: (pngDataUrl: string) => Promise<DeveloperSample>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample>
  captureFrame: () => Promise<DeveloperFrame>
}
