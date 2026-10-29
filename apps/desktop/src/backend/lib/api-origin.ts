const MAX_URL_LENGTH = 2_048

export class ApiOriginFailure extends Error {
  constructor() {
    super('API origin is invalid.')
    this.name = 'ApiOriginFailure'
    this.stack = `${this.name}: ${this.message}`
  }
}

export function validateApiOrigin(apiOrigin: string): string {
  const url = URL.parse(apiOrigin)
  // WHATWG URL은 hostname 길이를 제한하지 않아 길이 상한은 따로 둔다.
  if (apiOrigin.length > MAX_URL_LENGTH || url?.protocol !== 'https:' || url.origin !== apiOrigin) {
    throw new ApiOriginFailure()
  }

  return apiOrigin
}
