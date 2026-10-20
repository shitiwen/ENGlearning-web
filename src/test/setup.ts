import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

// 训练页会把题型/难度等筛选条件写进 localStorage；同一文件内的用例共享同一个
// jsdom 环境，这里统一清理，避免上一个用例的筛选条件影响下一个用例的首屏。
afterEach(() => {
  try { localStorage.clear() } catch { /* node 环境没有 localStorage */ }
})
