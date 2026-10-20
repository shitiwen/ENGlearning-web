import type { TrainerOverview } from '../trainerSpec'

// 成绩分级卡：对齐 examcrafts 专题成绩页的「优秀 / 良好 / 及格 / 需加强」四档评级，
// 同时保留本项目已有的把握度（确定/不确定）口径。

export function TrainingGradeCard({ overview }:{ overview:TrainerOverview }) {
  const grade = overview.grade
  if (!grade) return null
  return <section className={`training-grade grade-${grade.id}`} aria-label="成绩分级">
    <div className="grade-head">
      <strong>{grade.label}</strong>
      <span>{Math.round(overview.accuracy * 100)}% 正确率 · 用时 {overview.duration}</span>
    </div>
    <p>{grade.advice}</p>
    <ul className="grade-facts">
      <li>把握度：{overview.unsure ? `${overview.unsure} 题当时不确定` : '全部确定'}</li>
      <li>未作答：{overview.pending} 题</li>
      {overview.wordNote && <li>{overview.wordNote}</li>}
    </ul>
  </section>
}
