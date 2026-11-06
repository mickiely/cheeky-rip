import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'

type AudioSource = {
  name: string
  url: string
  kind: 'LOCAL FILE' | 'RIPPED STREAM'
}

const waveform = [
  28, 45, 68, 36, 74, 52, 88, 44, 62, 82, 38, 70, 94, 56, 80, 48, 66, 90, 42, 72, 52, 86, 34,
  64, 76, 46, 92, 58, 72, 40, 84, 50, 68, 32, 78, 54, 88, 44, 70, 60, 82, 38, 74, 48, 90, 56,
  68, 42,
]

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [isRipping, setIsRipping] = useState(false)
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<AudioSource | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [needsFile, setNeedsFile] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string[]>(['> Worker ready. Awaiting source input.'])

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url) }, [source])
  useEffect(() => () => requestRef.current?.abort(), [])

  const loadFile = (file?: File) => {
    if (isRipping) return
    if (!file || !file.type.startsWith('audio/')) {
      setStatus((lines) => [...lines.slice(-2), '> Error: MP3 or WAV audio files only.'])
      return
    }

    setNeedsFile(false)
    const objectUrl = URL.createObjectURL(file)
    setSource({ name: file.name, url: objectUrl, kind: 'LOCAL FILE' })
    setProgress(100)
    setStatus(['> Reading local audio buffer...', '> File decoded locally. No upload required.', '> Ready for spatial processing.'])
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => loadFile(event.target.files?.[0])

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    loadFile(event.dataTransfer.files?.[0])
  }

  const ripStream = async () => {
    if (requestRef.current) return
    try {
      const parsed = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      setStatus(['> Error: Paste a valid public HTTP(S) audio URL.'])
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    setIsRipping(true)
    setNeedsFile(false)
    setSource(null)
    setProgress(0)
    setStatus(['> Resolving public audio source...'])
    try {
      const response = await fetch('/.netlify/functions/rip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }), signal: controller.signal,
      })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
        // Read as text first: a missing function or proxy error can return an empty or HTML body.
        const body = await response.text()
        let result: { error?: string; message?: string; requiresDirectAudio?: boolean } = {}
        try { result = JSON.parse(body) } catch { /* non-JSON body */ }
        if (result.requiresDirectAudio) {
          setNeedsFile(true)
          dropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        throw new Error(result.message || result.error || (response.status === 404
          ? 'Rip service not found. Run `npm run dev` or `netlify dev` so /.netlify/functions/rip is served.'
          : `Rip service returned ${response.status} without audio.`))
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Audio stream unavailable.')
      const total = Number(response.headers.get('content-length'))
      const chunks: ArrayBuffer[] = []
      let received = 0
      setStatus((lines) => [...lines, '> Receiving audio stream...'])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        chunks.push(value.slice().buffer)
        if (total) setProgress(Math.min(99, Math.round(received / total * 100)))
        setStatus(['> Receiving audio stream...', `> ${(received / 1024).toFixed(0)} KB received.`])
      }
      if (!received) throw new Error('The source returned an empty audio file.')
      const blob = new Blob(chunks, { type: response.headers.get('content-type')! })
      const name = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'cheeky-rip.audio'
      setSource({ name, url: URL.createObjectURL(blob), kind: 'RIPPED STREAM' })
      setProgress(100)
      setStatus(['> Audio received successfully.', '> Download your file, then load it in TDAH SoundLab.'])
    } catch (error) {
      setProgress(0)
      setStatus([`> Error: ${error instanceof Error ? error.message : 'Download failed.'}`])
    } finally {
      requestRef.current = null
      setIsRipping(false)
    }
  }

  // SoundLab has no cross-origin import API, so save the blob locally while the link opens SoundLab in a new tab.
  const handOffToSoundLab = () => {
    if (!source) return
    const link = document.createElement('a')
    link.href = source.url
    link.download = source.name
    link.click()
    setStatus((lines) => [...lines.slice(-2), `> Saved ${source.name}. Load it in SoundLab for 8D spatial processing.`])
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="eyebrow">AUDIO LIBERATION UTILITY</span>
          <h1>CHEEKY RIP <span>// v1.0</span></h1>
          <p>Grab your music. Rescue old files. Take your audio anywhere.</p>
        </div>
        <div className="worker-status" aria-label={isRipping ? "Ripper engine working" : "Ripper engine ready"}>
          <span>RIPPER ENGINE</span>
          <strong><i aria-hidden="true" /> {isRipping ? 'WORKING' : 'READY'}</strong>
        </div>
      </header>

      <div className="ticker" aria-hidden="true">
        <span>SPOTIFY</span><b>///</b><span>SOUNDCLOUD</span><b>///</b><span>iTUNES</span><b>///</b><span>PUBLIC MEDIA</span><b>///</b><span>ZERO FLUFF</span>
      </div>

      <div className="dashboard-grid">
        <section className="panel extract-panel">
          <div className="section-heading">
            <span className="section-number">01</span>
            <div>
              <span className="eyebrow">STREAMING SOURCE</span>
              <h2>RIP A TRACK</h2>
            </div>
          </div>

          <label className="field-label" htmlFor="media-url">PUBLIC AUDIO FILE URL</label>
          <div className="url-row">
            <input
              id="media-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a direct MP3, WAV or audio URL..."
            />
            <button className="primary-button" type="button" onClick={ripStream} disabled={isRipping}>
              RIP AUDIO <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="terminal" aria-live="polite">
            <div className="terminal-header">
              <span>PROCESS LOG</span>
              <span>{progress.toString().padStart(3, '0')}%</span>
            </div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="terminal-output">
              {status.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            </div>
          </div>
        </section>

        <section className="panel rescue-panel">
          <div className="section-heading">
            <span className="section-number">02</span>
            <div>
              <span className="eyebrow">LEGACY LIBRARY</span>
              <h2>RESCUE OLD FILES</h2>
            </div>
          </div>

          <input ref={fileInputRef} className="visually-hidden" type="file" accept="audio/mpeg,audio/wav,audio/x-wav" onChange={handleFiles} />
          <div
            ref={dropZoneRef}
            className={`drop-zone ${isDragging || needsFile ? 'is-dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="file-icon" aria-hidden="true"><span>MP3</span></div>
            <h3>DROP LOCAL MP3 / WAV<br />FILES HERE</h3>
            <p>(iTunes / CD Rip Rescue)</p>
            <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
              BROWSE FILES
            </button>
          </div>
          <p className="privacy-note"><span aria-hidden="true">◆</span> Files process locally on your device. Nothing leaves the machine.</p>
        </section>

        <section className={`panel deck-panel result-panel ${source ? 'is-loaded' : ''}`}>
          <div className="deck-header">
            <div className="section-heading">
              <span className="section-number">03</span>
              <div>
                <span className="eyebrow">RIPPED AUDIO</span>
                <h2>READY TO GO</h2>
              </div>
            </div>
            <span className="loaded-badge">{source ? 'AUDIO READY' : 'AWAITING SOURCE'}</span>
          </div>

          <div className="track-strip">
            <div className="track-meta">
              <span>{source?.kind ?? 'NO SOURCE'}</span>
              <strong>{source?.name ?? 'Paste a link or drop a file to begin'}</strong>
            </div>
            <span className="format-badge">{source ? 'AUDIO' : 'WAITING'}</span>
          </div>

          <div className="waveform result-waveform" aria-label="Audio waveform preview">
            {waveform.map((height, index) => <span key={index} style={{ height: `${height}%`, animationDelay: `${index * -35}ms` }} />)}
          </div>

          <div className="handoff-panel">
            <div className="handoff-copy">
              <span className="eyebrow">WHAT NEXT?</span>
              <h3>KEEP IT, OR SEND IT TO SOUNDLAB.</h3>
              <p>Download your ripped audio, or open TDAH SoundLab and load the file there for spatial audio and frequency tools.</p>
            </div>
            <div className="handoff-actions">
              {source?.url ? (
                <a className="download-button" href={source.url} download={source.name}>
                  DOWNLOAD FILE <span aria-hidden="true">↓</span>
                </a>
              ) : (
                <button className="download-button" type="button" disabled>
                  DOWNLOAD FILE <span aria-hidden="true">↓</span>
                </button>
              )}
              <a
                className="soundlab-button"
                href="https://soundlab--tdah-360.netlify.app/soundlab"
                target="_blank"
                rel="noreferrer"
                onClick={handOffToSoundLab}
              >
                {source ? 'SAVE + OPEN IN SOUNDLAB' : 'OPEN IN TDAH SOUNDLAB'} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <span>CHEEKY RIP / MUSIC RESCUE TOOLKIT</span>
        <span>USE WITH AUDIO YOU HAVE THE RIGHT TO DOWNLOAD</span>
      </footer>
    </main>
  )
}
