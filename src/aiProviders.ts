export const aiProviders = {
  deepseek:{ label:'DeepSeek', endpoint:'https://api.deepseek.com/chat/completions', models:['deepseek-flash', 'deepseek-v4-pro'] },
  glm:{ label:'GLM（智谱）', endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions', models:['glm-4.6', 'glm-4.5-air'] },
  qwen:{ label:'Qwen（阿里云百炼·北京）', endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models:['qwen-plus', 'qwen-turbo', 'qwen-max'] },
} as const

export type AiProvider = keyof typeof aiProviders

export function isAiProvider(value:unknown):value is AiProvider {
  return typeof value === 'string' && Object.hasOwn(aiProviders, value)
}
