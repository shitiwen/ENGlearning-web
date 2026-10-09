export const aiProviders = {
  deepseek:{ label:'DeepSeek', endpoint:'https://api.deepseek.com/chat/completions', models:['deepseek-flash', 'deepseek-v4-pro'], docs:'https://api-docs.deepseek.com/quick_start/pricing/', note:'官方当前提供两个正式 API 型号：deepseek-flash 对应 V4.1-Flash；deepseek-v4-pro 对应 V4-Pro-0813。旧别名不作为独立模型列出。' },
  glm:{ label:'GLM（智谱）', endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions', models:['glm-4.7-flash', 'glm-5.3', 'glm-5.2', 'glm-5.1', 'glm-5-turbo', 'glm-5', 'glm-4.7', 'glm-4.7-flashx', 'glm-4.6', 'glm-4.5-air', 'glm-4.5-airx', 'glm-4.5-flash', 'glm-4-flash-250414', 'glm-4-flashx-250414'], docs:'https://docs.bigmodel.cn/api-reference/模型-api/对话补全', note:'使用智谱开放平台的通用 API Key。Coding Plan 和国际 Z.ai 的 Key 不能直接用于此接口；新旗舰模型可能需要更长响应时间。' },
  qwen:{ label:'Qwen（阿里云百炼·北京）', endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models:['qwen-plus', 'qwen-flash', 'qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-max', 'qwen3.7-plus', 'qwen3.7-flash', 'qwen3.6-plus', 'qwen3.6-flash', 'qwen3.5-plus', 'qwen3.5-flash', 'qwen3-max', 'qwen-max', 'qwen-turbo', 'qwen-plus-latest', 'qwen3-coder-plus', 'qwen3-coder-flash', 'qwen-long'], docs:'https://help.aliyun.com/zh/model-studio/qwen-structured-output', note:'使用百炼北京地域 Key。列表包含可用于文本与 JSON 输出的模型；latest 别名会跟随平台更新，Coder 偏向编程。模型权限与供应情况以你的控制台为准。' },
} as const

export type AiProvider = keyof typeof aiProviders

export function isAiProvider(value:unknown):value is AiProvider {
  return typeof value === 'string' && Object.hasOwn(aiProviders, value)
}
