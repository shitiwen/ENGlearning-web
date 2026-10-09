import { useEffect, useRef, useState } from 'react'
import { paperById, type PaperSection } from '../pastPapers'

export function PastPaperReader({ paperId, section, answers=false, onText }:{paperId:string;section:PaperSection;answers?:boolean;onText?:(text:string)=>void}) {
  const paper = paperById(paperId)
  const range = paper?.pages[section] ?? [1,1]
  const firstPage = range[0]
  const [pageNumber,setPageNumber] = useState(range[0])
  const [pageCount,setPageCount] = useState(0)
  const [zoom,setZoom] = useState(1)
  const [error,setError] = useState('')
  const [pageText,setPageText] = useState('')
  const [loading,setLoading] = useState(true)
  const [reload,setReload] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const documentRef = useRef<import('pdfjs-dist').PDFDocumentProxy>(null)
  const textCallback = useRef(onText)
  useEffect(() => { textCallback.current = onText },[onText])
  useEffect(() => { setPageNumber(answers ? 1 : firstPage) }, [section,answers,firstPage])
  useEffect(() => {
    let disposed = false
    let task:import('pdfjs-dist').PDFDocumentLoadingTask | undefined
    documentRef.current = null; setPageCount(0); setError(''); setLoading(true)
    void (async () => {
      const pdf = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdf.GlobalWorkerOptions.workerSrc = worker.default
      task = pdf.getDocument({url:`/api/past-paper-material?id=${encodeURIComponent(paperId)}&kind=${answers ? 'answers' : 'paper'}`})
      const document = await task.promise
      if (disposed) { await task.destroy(); return }
      documentRef.current = document; setPageCount(document.numPages)
    })().catch(() => { if (!disposed) { setError('原卷暂时读取失败。可重试读取；已填写答案仍保留。'); setLoading(false) } })
    return () => { disposed = true; void task?.destroy() }
  }, [paperId,answers,reload])
  useEffect(() => {
    let disposed = false
    let render:import('pdfjs-dist').RenderTask | undefined
    const document = documentRef.current
    if (!document || !canvas.current) return
    setLoading(true); setError(''); setPageText('')
    void (async () => {
      const page = await document.getPage(Math.min(pageNumber,document.numPages))
      if (disposed || !canvas.current) return
      const viewport = page.getViewport({scale:1.5*zoom})
      const element = canvas.current
      element.width = viewport.width; element.height = viewport.height
      render = page.render({canvas:element,viewport})
      await render.promise
      const content = await page.getTextContent()
      const text = content.items.map((item) => 'str' in item ? item.str+('hasEOL' in item && item.hasEOL ? '\n' : ' ') : '').join('')
      if (!disposed) { setPageText(text); textCallback.current?.(text) }
      if (!disposed) setLoading(false)
    })().catch((e:unknown) => { if (!disposed && !(e instanceof Error && e.name === 'RenderingCancelledException')) { setError('这一页显示失败，请重试。'); setLoading(false) } })
    return () => { disposed = true; render?.cancel() }
  }, [pageNumber,pageCount,zoom,reload])
  return <section className="past-paper-reader" aria-label={answers ? '原答案资料' : '原卷阅读'}>
    <div className="paper-reader-controls"><button disabled={pageNumber <= 1 || !pageCount} onClick={() => setPageNumber((n) => n-1)}>上一页</button><label>原卷页码<select aria-label={answers ? '答案资料页码' : '原卷页码'} value={pageNumber} disabled={!pageCount} onChange={(e) => setPageNumber(Number(e.target.value))}>{Array.from({length:pageCount || 1},(_,i) => <option key={i+1} value={i+1}>{i+1} / {pageCount || '…'}</option>)}</select></label><button disabled={pageNumber >= pageCount} onClick={() => setPageNumber((n) => n+1)}>下一页</button><button onClick={() => setZoom(zoom === 1 ? 1.6 : 1)}>{zoom === 1 ? '放大原卷' : '适应宽度'}</button></div>
    {loading && <p role="status">正在显示原卷…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={() => setReload((n) => n+1)}>重试读取</button>{paper && <a href={answers ? paper.answerUrl : paper.sourceUrl} target="_blank" rel="noreferrer">打开原来源</a>}</div>}
    <div className={`paper-canvas-scroll ${zoom > 1 ? 'zoomed' : ''}`}><canvas ref={canvas} aria-label={`原卷第 ${pageNumber} 页`} /></div>
    <details className="paper-text-view"><summary>当前页文字视图</summary><p>{pageText.trim() || '这一页没有可提取的文字，请查看原卷图像。'}</p></details>
    <small>按原卷题号作答 · 当前题型建议查看第 {range[0]}–{range[1]} 页，题目可能跨页。</small>
  </section>
}
