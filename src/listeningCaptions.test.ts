import { expect,it } from 'vitest'
import { parseListeningCaptions,validateListeningCues } from './listeningCaptions'
import { validateTrainingPacks } from './trainingPacks'
import { trainingPacks } from './data/seed'

it('读取真实 VTT/SRT 时间，不按原文字数估算，并移除字幕标签', () => {
  expect(parseListeningCaptions('WEBVTT\n\n00:01.200 --> 00:03.000\nHello <b>world</b>.\n\n00:04.000 --> 00:06.500\nSecond sentence.')).toEqual([{start:1.2,end:3,text:'Hello world.'},{start:4,end:6.5,text:'Second sentence.'}])
  expect(parseListeningCaptions('1\r\n00:00:01,000 --> 00:00:02,250\r\nOne sentence.')[0]).toEqual({start:1,end:2.25,text:'One sentence.'})
  expect(() => parseListeningCaptions('Just an untimed transcript.')).toThrow()
})

it('拒绝倒序、重叠、无穷时间、非法文件，导入失败不会生成假时间轴', () => {
  for (const value of [[{start:2,end:1,text:'x'}],[{start:0,end:3,text:'x'},{start:2,end:4,text:'y'}],[{start:0,end:Infinity,text:'x'}],[]]) expect(() => validateListeningCues(value)).toThrow()
  expect(() => parseListeningCaptions('00:99.000 --> 01:00.000\nx')).toThrow()
  expect(() => parseListeningCaptions('x'.repeat(500001))).toThrow()
  const pack = trainingPacks.find(pack => pack.type === 'listening')!
  expect(validateTrainingPacks([{...pack,captions:[{start:0,end:2,text:'verified'}]}])).toHaveLength(1)
  expect(validateTrainingPacks([{...pack,transcript:undefined,captions:[{start:0,end:2,text:'verified'}]}])).toHaveLength(1)
  expect(validateTrainingPacks([{...pack,captions:[{start:3,end:1,text:'bad'}]}])).toEqual([])
})

it('重复说出的句子保留独立标记，不因文字相同而合并', () => {
  expect(validateListeningCues([{start:0,end:1,text:'Yes.',sentenceIndex:0},{start:2,end:3,text:'Yes.',sentenceIndex:1}]).map(cue => cue.sentenceIndex)).toEqual([0,1])
  expect(() => validateListeningCues([{start:0,end:1,text:'Yes.',sentenceIndex:-1}])).toThrow()
})
