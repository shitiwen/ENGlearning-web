export type ModuleType = 'vocabulary' | 'content' | 'listening' | 'reading' | 'speaking'
export type TaskTier = 'minimum' | 'standard' | 'bonus'
export type TaskStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'deferred'
export type Confidence = 'sure' | 'unsure'
export type ExamTarget = 'general' | 'cet4' | 'cet6' | 'postgrad1' | 'postgrad2'
export type WordBookId = 'general-core' | 'cet4-core' | 'cet6-core' | 'postgrad1-core' | 'postgrad2-core'
export type EnglishLevel = 'beginner' | 'foundation' | 'intermediate' | 'strong'
export type LearnerStage = 'middle-school' | 'high-school' | 'college' | 'postgraduate' | 'working' | 'other'

export interface LearnerProfile {
  id: string
  display_name: string
  age_band: 'under-15' | '15-17' | '18-22' | '23-30' | '31-plus'
  learner_stage: LearnerStage
  grade_label: string
  field_of_study: string
  english_level: EnglishLevel
  recent_exam_name: string
  recent_exam_score: number | null
  recent_exam_max_score: number | null
  recent_exam_date: string | null
  primary_goal: ExamTarget
  interests: string[]
  onboarding_completed_at: string | null
  updated_at: string
}

export interface Settings {
  id: 'app'
  busyMinutes: number
  normalMinutes: number
  bonusMinutes: number
  preferredTopics: string[]
  blockedTopics: string[]
  dictionaryOnline: boolean
  semesterStartDate: string
  listeningTransitionDays: 7 | 14
  onboardingStartedAt: string
  examTarget: ExamTarget
  wordBookId: WordBookId
  autoUpdatePractice: boolean
  vocabReviewLimit: number
  vocabNewLimit: number
}

export interface ScheduleBlock {
  id: string
  weekday: number
  label: string
  start: string
  end: string
  weeks: 'all' | 'odd' | 'even'
}

export interface DateOverride {
  date: string
  availableMinutes?: number
  busy: boolean
  note?: string
}

export interface DailyTask {
  id: string
  date: string
  module: ModuleType
  title: string
  minutes: number
  itemCount?: number
  tier: TaskTier
  status: TaskStatus
  reason: string
  sourceId?: string
  startedAt?: string
  completedAt?: string
}

export interface ContentGlossary {
  term: string
  pos: string
  meaningZh: string
  explanation: string
  example: string
  derivatives?: string[]
  collocations?: string[]
  englishDefinition?: string
  wordParts?: string
  synonyms?: string[]
  antonyms?: string[]
  phonetic?: string
}

export interface ContentItem {
  id: string
  title: string
  creator: string
  publisher: string
  publishedAt: string
  kind: 'article' | 'news' | 'video' | 'blog'
  sourceUrl: string
  mediaUrl?: string
  mediaKind?: 'video' | 'audio'
  embedUrl?: string
  accessScope?: 'china' | 'international' | 'local'
  captionStatus?: 'verified' | 'none' | 'unknown' | 'transcript'
  captionControl?: 'site' | 'player' | 'fixed' | 'none'
  englishCaptionUrl?: string
  captionNote?: string
  estimatedMinutes: number
  topics: string[]
  summary?: string
  text?: string
  glossary?: ContentGlossary[]
  note?: string
  comprehension?: 'understood' | 'effortful' | 'lost'
  oneSentenceSummary?: string
  completedAt?: string
  createdAt: string
}

export interface VocabularyEntry {
  id: string
  term: string
  normalized: string
  pos: string
  meaningZh: string
  explanation: string
  contextSentence: string
  example: string
  sourceContentId?: string
  sourceLabel: string
  createdAt: string
  dueAt: string
  intervalDays: number
  correctCount: number
  sureCorrectCount: number
  wrongCount: number
  state: 'new' | 'learning' | 'mastered'
  phonetic?: string
  derivatives?: string[]
  collocations?: string[]
  englishDefinition?: string
  wordParts?: string
  synonyms?: string[]
  antonyms?: string[]
  reviewStage?: number
  lapses?: number
  bookIds?: WordBookId[]
}

export interface Question {
  id: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  evidence?: string
  vocabularyId?: string
}

export interface TrainingPack {
  id: string
  type: Exclude<ModuleType, 'content'>
  title: string
  difficulty: 'foundation' | 'standard' | 'challenge'
  estimatedMinutes: number
  passage?: string
  audioUrl?: string
  transcript?: string
  questions: Question[]
  attribution: string
  sourceUrl?: string
  accessScope?: 'china' | 'international' | 'local'
  transitionPhase?: 'foundation' | 'cet4-news' | 'cet4-conversation' | 'cet4-passage'
  recommendedDays?: string
  examTargets?: ExamTarget[]
  license?: string
  verifiedAt?: string
}

export interface AnswerRecord {
  questionId: string
  selected: number
  correct: boolean
  confidence: Confidence
  timeMs: number
  wrongReason?: '词义' | '定位' | '推断' | '听辨' | '走神' | '猜测' | '其他'
}

export interface TrainingSession {
  id: string
  packId: string
  module: Exclude<ModuleType, 'content'>
  startedAt: string
  updatedAt: string
  submittedAt?: string
  elapsedMs: number
  answers: AnswerRecord[]
  accuracy?: number
  uncertaintyRate?: number
  status: 'active' | 'paused' | 'submitted'
  speakingResult?: {
    promptId: string
    repetitions: number
    fluency: 1 | 2 | 3 | 4 | 5
    clarity: 1 | 2 | 3 | 4 | 5
    note?: string
  }
}

export interface Highlight {
  id: string
  contentId: string
  start: number
  end: number
  text: string
  color: string
  createdAt: string
}

export interface Scratchpad {
  contentId: string
  strokes: Array<{ color: string; width: number; points: Array<{ x: number; y: number }> }>
  updatedAt: string
}

export interface BackupFile {
  schemaVersion: 1
  exportedAt: string
  app: 'english-loop'
  data: Record<string, unknown[]>
}
