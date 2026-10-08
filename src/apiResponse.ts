export async function readApiJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('在线服务暂不可用，请稍后重试；已保存的学习材料仍可使用。')
  }
  let value: T & { error?: string }
  try { value = await response.json() }
  catch { throw new Error('在线服务返回的数据不完整，请稍后重试。') }
  if (!response.ok) throw new Error(value.error || '在线请求失败，请稍后重试。')
  return value
}
