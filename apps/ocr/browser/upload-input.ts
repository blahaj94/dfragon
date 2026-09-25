import { OCR_UPLOAD } from '../src/constants.js'
import { OCR_MESSAGES } from './constants.js'

export class UploadInputError extends Error {}

export function assertUploadFile(file: File | null): asserts file is File {
  if (file === null) {
    throw new UploadInputError(OCR_MESSAGES.selectPng)
  }
  if (file.size > OCR_UPLOAD.maximumPngBytes) {
    throw new UploadInputError(OCR_MESSAGES.pngTooLarge)
  }
}

export function readPngBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.includes(',')) {
        reject(new UploadInputError(OCR_MESSAGES.fileReadFailed))
        return
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new UploadInputError(OCR_MESSAGES.fileReadFailed))
    reader.readAsDataURL(file)
  })
}
