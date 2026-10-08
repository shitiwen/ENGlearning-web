import type { ContentItem } from './types'

export interface SpeakingPrompt {
  id:string; level:string; title:string; text:string; task:string; cues:string[]
  accessScope:'china'|'international'|'local'
  audioUrl?:string; videoUrl?:string; embedUrl?:string; sourceUrl?:string; sourceLabel?:string
}

export function contentSpeakingPrompts(contents:ContentItem[]):SpeakingPrompt[] {
  return contents.filter((item) => item.text?.trim() || item.mediaUrl || item.embedUrl).map((item) => {
    const media = Boolean(item.mediaUrl || item.embedUrl)
    return {
      id:`content-${item.id}`, title:item.title,
      level:media ? item.mediaKind === 'audio' ? '音频跟读' : '视频模仿' : '阅读复述',
      text:item.text ?? '',
      task:media ? '先听 30–60 秒，抓住主旨；暂停模仿一句，再脱离材料复述 60 秒。页面文字可能是节选，请以原素材为准。' : '读完材料，合上文本；用自己的话说出主旨、两个细节和你的看法，连续说 60–90 秒。',
      cues:['What is the main idea?', 'Which details support it?', 'What do you think?'],
      accessScope:item.accessScope ?? (item.publisher.includes('原创') ? 'local' : 'international'),
      audioUrl:item.mediaKind === 'audio' ? item.mediaUrl : undefined,
      videoUrl:item.mediaKind === 'video' ? item.mediaUrl : undefined,
      embedUrl:item.embedUrl,
      sourceUrl:item.sourceUrl.includes('example.com/') ? undefined : item.sourceUrl,
      sourceLabel:item.publisher,
    }
  })
}
