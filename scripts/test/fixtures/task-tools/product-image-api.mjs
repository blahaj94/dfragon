export function createProductImageApiFixture() {
  const successfulRun = {
    id: 123,
    event: 'workflow_run',
    head_branch: 'main',
    conclusion: 'success'
  }
  const baselineArtifact = { id: 456, name: 'product-image-plan', expired: false }
  const apiOptions = {
    apiUrl: 'https://api.github.com',
    repository: 'example/product',
    token: 'synthetic-read-token'
  }
  const baselineApi = (responses, requests = []) => {
    const queue = [...responses]

    return async (url, options) => {
      requests.push({ url, options })

      return { ok: true, json: async () => queue.shift() }
    }
  }

  return { successfulRun, baselineArtifact, apiOptions, baselineApi }
}
