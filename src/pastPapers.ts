import index from './data/pastPaperIndex.json'
import type { TrainingPack } from './types'
import type { WrittenPrompt } from './data/writtenPractice'

export const paperSectionLabels = { writing:'写作', listening:'听力', cloze:'选词填空', matching:'段落匹配', reading:'阅读理解', translation:'翻译' }
export type PaperSection = keyof typeof paperSectionLabels
export const pastPapers = index
export type PastPaper = typeof index[number]
export const questionSection = (number:number):PaperSection => number <= 25 ? 'listening' : number <= 35 ? 'cloze' : number <= 45 ? 'matching' : 'reading'
export const paperById = (id?:string) => pastPapers.find((paper) => paper.id === id)

export function pastPaperPack(paper:PastPaper, section:'full'|'listening'|'cloze'|'matching'|'reading'):TrainingPack {
  const topic = section === 'full' ? 'reading' : section
  const questions = Object.entries(paper.answers).filter(([n]) => section === 'full' || questionSection(Number(n)) === section).map(([n,letter]) => {
    const count = Number(n) <= 25 || Number(n) >= 46 ? 4 : Number(n) <= 35 ? 15 : paper.set === 2 ? 15 : 10
    return { id:`${paper.id}-q${n}`, prompt:`原卷第 ${n} 题 · ${paperSectionLabels[questionSection(Number(n))]}`, options:Array.from({length:count},(_,i) => `原卷选项 ${String.fromCharCode(65+i)}`), answer:letter.charCodeAt(0)-65, explanation:`对应卷型的答案资料标注为 ${letter}。交卷后可在页面内查看原答案资料；解析未提供逐题详细说明。` }
  })
  return { id:`${paper.id}-${section}`,title:`${paper.title}｜${section === 'full' ? '整套练习' : paperSectionLabels[section]}`,type:topic === 'listening' ? 'listening' : 'reading',topic,difficulty:'standard',estimatedMinutes:section === 'full' ? 125 : section === 'listening' ? 25 : section === 'cloze' ? 10 : 15,questions,examTargets:[paper.target as 'cet4'|'cet6'],examYear:paper.year,examMonth:paper.month as 6,examSet:paper.set,pastPaperId:paper.id,paperSection:section,sourceUrl:paper.sourceUrl,audioUrl:paper.audioUrl ?? undefined,accessScope:'local',attribution:'历年真题 · 原卷在线阅读，答案按对应卷型资料核对；非官方整理。',license:'原考试资料权利归原权利人；原来源按需读取',verifiedAt:paper.verifiedAt }
}

export const pastPaperPacks = pastPapers.flatMap((paper) => (['listening','cloze','matching','reading'] as const).filter((section) => section !== 'listening' || paper.audioUrl).map((section) => pastPaperPack(paper,section)))
export const fullPaperPacks = pastPapers.filter((paper) => paper.audioUrl && Object.keys(paper.answers).length === 55).map((paper) => pastPaperPack(paper,'full'))
export const pastWrittenPrompts:WrittenPrompt[] = pastPapers.flatMap((paper) => (['writing','translation'] as const).map((kind) => ({ id:`${paper.id}-${kind}`,kind,title:`${paper.title}｜${paperSectionLabels[kind]}`,examTargets:[paper.target as 'cet4'|'cet6'],instructions:'请按页面内原卷的题目要求作答。使用原卷页码切换查看完整要求。',estimatedMinutes:30,minWords:kind === 'writing' ? 120 : undefined,maxWords:kind === 'writing' ? 180 : undefined,reference:'参考作答请在交卷后查看下方原答案资料；参考范文和译文不是唯一答案。',tips:['检查是否完成原卷要求。','检查信息完整、语法和用词。'],pastPaperId:paper.id })))
