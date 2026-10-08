import { describe, expect, it } from 'vitest'
import { contentSpeakingPrompts } from './speakingResources'
import type { ContentItem } from './types'

const content:ContentItem = { id:'test', title:'Test', creator:'Author', publisher:'English Loop 原创', publishedAt:'2026-10-08', kind:'article', sourceUrl:'https://example.com/english-loop/test', estimatedMinutes:5, topics:[], createdAt:'2026-10-08' }

describe('内容库口语素材', () => {
  it('跳过只有外链的入口，保留可复述文本并隐藏占位来源', () => {
    expect(contentSpeakingPrompts([content])).toEqual([])
    expect(contentSpeakingPrompts([{ ...content, text:'A short passage.' }])[0]).toMatchObject({ text:'A short passage.', accessScope:'local', level:'阅读复述', sourceUrl:undefined })
  })
  it('视频和音频保留真实播放地址，不生成假逐字稿', () => {
    const [video, audio] = contentSpeakingPrompts([{ ...content, mediaKind:'video', mediaUrl:'https://media.example/video.mp4', accessScope:'china' }, { ...content, id:'audio', mediaKind:'audio', mediaUrl:'https://media.example/audio.mp3' }])
    expect(video).toMatchObject({ videoUrl:'https://media.example/video.mp4', text:'', accessScope:'china' })
    expect(audio).toMatchObject({ audioUrl:'https://media.example/audio.mp3', level:'音频跟读' })
  })
})
