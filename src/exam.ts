import type { ExamTarget, WordBookId } from './types'

export const examTargets: Array<{ id:ExamTarget; label:string; short:string; description:string }> = [
  { id:'general', label:'通用英语', short:'通用', description:'日常输入、校园表达与基础能力' },
  { id:'cet4', label:'大学英语四级', short:'四级', description:'短篇新闻、长对话与四级阅读' },
  { id:'cet6', label:'大学英语六级', short:'六级', description:'信息密度更高的听读与推断' },
  { id:'postgrad1', label:'考研英语一', short:'考研一', description:'学术议论文、复杂论证与精读' },
  { id:'postgrad2', label:'考研英语二', short:'考研二', description:'应用型文本、管理与社会议题' }
]

export const wordBooks: Array<{ id:WordBookId; target:ExamTarget; label:string; description:string }> = [
  { id:'general-core', target:'general', label:'通用核心词', description:'日常、校园和科技输入中的常用词' },
  { id:'cet4-core', target:'cet4', label:'四级核心词', description:'四级过渡与常见学术基础词' },
  { id:'cet6-core', target:'cet6', label:'六级进阶词', description:'更抽象的新闻、社会与科技表达' },
  { id:'postgrad1-core', target:'postgrad1', label:'考研英语一核心词', description:'论证、研究和长难句高频表达' },
  { id:'postgrad2-core', target:'postgrad2', label:'考研英语二核心词', description:'应用文、管理与社会议题表达' }
]

export const defaultBookForTarget:Record<ExamTarget,WordBookId> = {
  general:'general-core', cet4:'cet4-core', cet6:'cet6-core', postgrad1:'postgrad1-core', postgrad2:'postgrad2-core'
}

export const examLabel = (target:ExamTarget) => examTargets.find((item) => item.id === target)?.label ?? target
