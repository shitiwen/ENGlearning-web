import { ChevronLeft, FolderPlus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db'
import {
  collectionStats,
  collectionWrongReasons,
  createCollection,
  deleteCollection,
  filterCollectionItems,
  mistakeCollectionSortLabels,
  removeCollectionItem,
  renameCollection,
  setItemMastered,
  sortCollections,
} from '../mistakeCollections'
import type { MistakeCollection, MistakeCollectionItem, MistakeCollectionSort } from '../types'

// 错题合集：对齐 examcrafts 错题本的合集 / 掌握率 / 排序 / 原文展开能力，
// 但数据全部留在本地 IndexedDB，不依赖账号。

export function MistakeCollections() {
  const [activeId, setActiveId] = useState<string>()
  const [sort, setSort] = useState<MistakeCollectionSort>({ field: 'updated', direction: 'desc' })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const collections = useLiveQuery(() => db.mistakeCollections.toArray(), [], [] as MistakeCollection[])
  const items = useLiveQuery(() => db.mistakeItems.toArray(), [], [] as MistakeCollectionItem[])

  const grouped = useMemo(() => {
    const map: Record<string, MistakeCollectionItem[]> = {}
    for (const collection of collections) map[collection.id] = []
    for (const item of items) (map[item.collectionId] ??= []).push(item)
    return map
  }, [collections, items])

  const ordered = useMemo(() => sortCollections(collections, grouped, sort), [collections, grouped, sort])
  const active = collections.find((collection) => collection.id === activeId)

  const create = async () => {
    setBusy(true); setMessage('')
    try {
      const collection = await createCollection({ name, description })
      setName(''); setDescription('')
      setMessage(`已创建合集「${collection.name}」`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '创建失败，请稍后重试') }
    finally { setBusy(false) }
  }

  const rename = async (collection: MistakeCollection) => {
    const next = window.prompt('合集名称', collection.name)
    if (next === null) return
    try { setMessage(`已改名为「${await renameCollection(collection.id, next)}」`) }
    catch (error) { setMessage(error instanceof Error ? error.message : '重命名失败') }
  }

  const remove = async (collection: MistakeCollection) => {
    if (!window.confirm(`删除合集「${collection.name}」及其中的 ${grouped[collection.id]?.length ?? 0} 道错题？`)) return
    try { await deleteCollection(collection.id); if (activeId === collection.id) setActiveId(undefined); setMessage('合集已删除') }
    catch (error) { setMessage(error instanceof Error ? error.message : '删除失败，请稍后重试') }
  }

  if (active) return <CollectionDetail collection={active} items={grouped[active.id] ?? []} onBack={() => setActiveId(undefined)} />

  return <section className="training-review-list mistake-collections">
    <header className="collection-head">
      <div><h2>错题合集</h2><p>把不同训练里答错或当时不确定的题按自己的复习主题分组；合集里的题干是作答当时的快照。</p></div>
      <label className="collection-sort">排序<select value={`${sort.field}:${sort.direction}`} onChange={(event) => { const [field, direction] = event.target.value.split(':') as [MistakeCollectionSort['field'], MistakeCollectionSort['direction']]; setSort({ field, direction }) }}>
        <option value="updated:desc">{mistakeCollectionSortLabels.updated} · 新→旧</option>
        <option value="mastery:desc">{mistakeCollectionSortLabels.mastery} · 高→低</option>
        <option value="count:desc">{mistakeCollectionSortLabels.count} · 多→少</option>
        <option value="created:desc">{mistakeCollectionSortLabels.created} · 新→旧</option>
        <option value="name:asc">{mistakeCollectionSortLabels.name} · A→Z</option>
      </select></label>
    </header>
    {message && <p className="notice" role="status">{message}</p>}
    <section className="panel collection-create">
      <h3>新建合集</h3>
      <label>名称<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="例如：阅读定位题、听力数字题" /></label>
      <label>说明<input value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} placeholder="可选，写给自己看的复习目标" /></label>
      <button className="primary" disabled={busy || !name.trim()} onClick={() => void create()}><FolderPlus size={16} /> 创建合集</button>
    </section>
    {ordered.length ? <div className="collection-grid">{ordered.map((collection) => {
      const stats = collectionStats(grouped[collection.id] ?? [])
      return <article className="collection-card" key={collection.id}>
        <header><h3>{collection.name}</h3><span className="content-kind">{collection.origin === 'session' ? '训练收集' : '手动创建'}</span></header>
        {collection.description && <p className="collection-desc">{collection.description}</p>}
        <p className="collection-meta">{stats.total} 题 · 已掌握 {stats.mastered} · 待复习 {stats.pending} · 掌握率 {Math.round(stats.masteryRate * 100)}%</p>
        <progress aria-label={`${collection.name} 掌握率`} value={stats.mastered} max={stats.total || 1} />
        <p className="collection-meta">最近更新 {new Date(collection.updatedAt).toLocaleString('zh-CN')}</p>
        <div className="collection-actions">
          <button className="primary compact" onClick={() => setActiveId(collection.id)}>整理错题</button>
          <button className="secondary compact" onClick={() => void rename(collection)}>改名</button>
          <button className="secondary compact" onClick={() => void remove(collection)}><Trash2 size={14} /> 删除</button>
        </div>
      </article>
    })}</div> : <p className="content-empty">还没有错题合集。可以在这里新建，或在训练结果页把本次错题一次性收进新合集。</p>}
  </section>
}

function CollectionDetail({ collection, items, onBack }:{ collection:MistakeCollection; items:MistakeCollectionItem[]; onBack:()=>void }) {
  const [reason, setReason] = useState('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const stats = collectionStats(items)
  const visible = filterCollectionItems(items, { wrongReason: reason, pendingOnly })
  const toggleExpanded = (id:string) => setExpanded((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id])

  const master = async (item:MistakeCollectionItem) => {
    try { await setItemMastered(item.id, !item.mastered); setMessage(item.mastered ? '已移回待复习' : '已标记为掌握') }
    catch (error) { setMessage(error instanceof Error ? error.message : '掌握状态保存失败') }
  }
  const drop = async (item:MistakeCollectionItem) => {
    try { await removeCollectionItem(item.id); setMessage('已从合集中移除') }
    catch (error) { setMessage(error instanceof Error ? error.message : '移除失败') }
  }

  return <section className="training-review-list collection-detail">
    <button className="secondary compact" onClick={onBack}><ChevronLeft size={15} /> 返回合集列表</button>
    <header className="collection-head">
      <div><h2>{collection.name}</h2>{collection.description && <p>{collection.description}</p>}<p>{stats.total} 题 · 已掌握 {stats.mastered} · 待复习 {stats.pending} · 掌握率 {Math.round(stats.masteryRate * 100)}%</p></div>
    </header>
    <nav className="collection-filters" aria-label="错题筛选">
      <label>错因<select value={reason} onChange={(event) => setReason(event.target.value)}>{collectionWrongReasons.map((value) => <option key={value} value={value}>{value === 'all' ? '全部错因' : value}</option>)}</select></label>
      <label className="collection-toggle"><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> 只看待复习</label>
      <span>显示 {visible.length} / {stats.total} 题</span>
    </nav>
    {message && <p className="notice" role="status">{message}</p>}
    {visible.length ? visible.map((item) => {
      const open = expanded.includes(item.id)
      return <article className={`panel mistake-item ${item.mastered ? 'is-mastered' : ''}`} key={item.id}>
        <header className="mistake-head">
          <div><span className="content-kind">{item.packTitle}</span><h3>{item.prompt}</h3></div>
          <div className="mistake-actions">
            <button className="secondary compact" onClick={() => void master(item)}>{item.mastered ? '移回待复习' : '已掌握'}</button>
            <button className="secondary compact" onClick={() => void drop(item)}><Trash2 size={14} /> 移除</button>
          </div>
        </header>
        <ol className="mistake-options">{item.options.map((option, index) => <li key={index} className={`${index === item.answer ? 'is-correct' : ''} ${index === item.selected && index !== item.answer ? 'is-wrong' : ''}`}><span>{String.fromCharCode(65 + index)}</span>{option}</li>)}</ol>
        <p className="mistake-answer">你的答案：{item.selected < 0 ? '未作答' : String.fromCharCode(65 + item.selected)} · 参考答案：{String.fromCharCode(65 + item.answer)}{item.confidence === 'unsure' ? ' · 当时不确定' : ''}{item.wrongReason ? ` · 错因：${item.wrongReason}` : ''}</p>
        <p className="mistake-explain">{item.explanation}</p>
        {item.evidence && <p className="mistake-evidence">依据：{item.evidence}</p>}
        {item.passage && <><button className="secondary compact" onClick={() => toggleExpanded(item.id)}>{open ? '隐藏原文' : '显示原文'}</button>{open && <article className="reading-passage">{item.passage}</article>}</>}
      </article>
    }) : <p className="content-empty">当前筛选下没有错题。切回「全部错因」或取消「只看待复习」。</p>}
  </section>
}
