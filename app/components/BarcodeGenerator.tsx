'use client'

import { useState, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import JSZip from 'jszip'

interface BarcodeData {
  value: string
  svgString: string
}

const FORMATS = [
  { value: 'CODE128', label: 'Code 128 (Recommended)' },
  { value: 'CODE39', label: 'Code 39' },
  { value: 'CODE128B', label: 'Code 128B' },
  { value: 'CODE128C', label: 'Code 128C (Numeric only)' },
]

function generateBarcodeSVG(value: string, format: string): string {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svgEl, value, {
    format,
    width: 2,
    height: 80,
    displayValue: true,
    fontSize: 14,
    margin: 10,
    background: '#ffffff',
    lineColor: '#0f172a',
  })
  const raw = new XMLSerializer().serializeToString(svgEl)
  // Make SVG responsive in cards
  return raw.replace('<svg ', '<svg style="max-width:100%;height:auto;" ')
}

async function svgToPngBlob(svgString: string, scale = 3): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * scale
      canvas.height = img.naturalHeight * scale
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas conversion failed'))),
        'image/png'
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG'))
    }
    img.src = url
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 200)
}

export default function BarcodeGenerator() {
  const [prefix, setPrefix] = useState('CERT')
  const [startNumber, setStartNumber] = useState(1)
  const [count, setCount] = useState(10)
  const [padLength, setPadLength] = useState(4)
  const [format, setFormat] = useState('CODE128')
  const [barcodes, setBarcodes] = useState<BarcodeData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<'svg' | 'png' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const safeCount = Math.min(Math.max(count, 1), 500)
  const previewFirst = `${prefix}${String(startNumber).padStart(padLength, '0')}`
  const previewLast =
    safeCount > 1
      ? `${prefix}${String(startNumber + safeCount - 1).padStart(padLength, '0')}`
      : null

  const handleGenerate = useCallback(() => {
    setError(null)
    setBarcodes([])
    setIsGenerating(true)
    // Defer heavy work so the UI can update first
    setTimeout(() => {
      try {
        const results: BarcodeData[] = []
        for (let i = 0; i < safeCount; i++) {
          const num = startNumber + i
          const padded = String(num).padStart(padLength, '0')
          const value = (`${prefix}${padded}`).trim() || String(num)
          try {
            results.push({ value, svgString: generateBarcodeSVG(value, format) })
          } catch {
            setError(
              `Could not generate barcode for "${value}". The value may be incompatible with ${format}. Try Code 128 instead.`
            )
            break
          }
        }
        setBarcodes(results)
      } finally {
        setIsGenerating(false)
      }
    }, 30)
  }, [prefix, startNumber, safeCount, padLength, format])

  const downloadSingle = async (barcode: BarcodeData, type: 'svg' | 'png') => {
    if (type === 'svg') {
      triggerDownload(
        new Blob([barcode.svgString], { type: 'image/svg+xml' }),
        `${barcode.value}.svg`
      )
    } else {
      try {
        const blob = await svgToPngBlob(barcode.svgString)
        triggerDownload(blob, `${barcode.value}.png`)
      } catch (e) {
        console.error(e)
      }
    }
  }

  const downloadAll = async (type: 'svg' | 'png') => {
    if (!barcodes.length || bulkLoading) return
    setBulkLoading(type)
    try {
      const zip = new JSZip()
      const folder = zip.folder('barcodes')!
      for (const barcode of barcodes) {
        if (type === 'svg') {
          folder.file(`${barcode.value}.svg`, barcode.svgString)
        } else {
          folder.file(`${barcode.value}.png`, await svgToPngBlob(barcode.svgString))
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      triggerDownload(zipBlob, `${prefix || 'barcodes'}-${type}.zip`)
    } catch {
      setError('Failed to create ZIP archive. Please try again.')
    } finally {
      setBulkLoading(null)
    }
  }

  const exportCSV = () => {
    const lines = ['Value', ...barcodes.map((b) => b.value)]
    triggerDownload(
      new Blob([lines.join('\n')], { type: 'text/csv' }),
      `${prefix || 'barcodes'}-values.csv`
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            }}
          >
            {/* Barcode icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <rect x="1"   y="4" width="3"   height="16" rx="0.4" />
              <rect x="6"   y="4" width="1.5" height="16" rx="0.4" />
              <rect x="9"   y="4" width="2.5" height="16" rx="0.4" />
              <rect x="13.5" y="4" width="1" height="16" rx="0.4" />
              <rect x="16"  y="4" width="3"   height="16" rx="0.4" />
              <rect x="21"  y="4" width="2"   height="16" rx="0.4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Certificate Barcode Generator
            </h1>
            <p className="text-sm text-slate-500 leading-tight">
              Generate unique sequential barcodes for student certificates
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* ── Config card ────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-7"
          style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        >
          <h2 className="text-base font-semibold text-slate-800 mb-5">Configuration</h2>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <Field label="Prefix">
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="CERT"
                className="input font-mono"
              />
            </Field>

            <Field label="Starting Number">
              <input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="input"
              />
            </Field>

            <Field label={<>Count <span className="text-slate-400 font-normal">(1–500)</span></>}>
              <input
                type="number"
                value={count}
                onChange={(e) =>
                  setCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))
                }
                min={1}
                max={500}
                className="input"
              />
            </Field>

            <Field label="Number Padding">
              <input
                type="number"
                value={padLength}
                onChange={(e) =>
                  setPadLength(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))
                }
                min={1}
                max={10}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Barcode Format">
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="input bg-white">
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Preview">
              <div className="input bg-slate-50 font-mono text-slate-600 text-sm select-none cursor-default">
                {previewLast ? (
                  <>
                    {previewFirst}{' '}
                    <span className="text-slate-400">→</span>{' '}
                    {previewLast}
                  </>
                ) : (
                  previewFirst
                )}
                <span className="text-slate-400 ml-2">({safeCount})</span>
              </div>
            </Field>
          </div>

          {error && (
            <div
              className="mt-4 px-4 py-3 rounded-lg text-sm text-red-700"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          <div className="mt-5">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating
                ? 'Generating…'
                : `Generate ${safeCount} Barcode${safeCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* ── Empty state ─────────────────────────────────────── */}
        {!isGenerating && barcodes.length === 0 && !error && (
          <div className="text-center py-16">
            <div
              className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
              style={{ width: 64, height: 64, background: '#f1f5f9' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
                <rect x="1"   y="4" width="3"   height="16" rx="0.5" />
                <rect x="6"   y="4" width="1.5" height="16" rx="0.5" />
                <rect x="9"   y="4" width="2.5" height="16" rx="0.5" />
                <rect x="13.5" y="4" width="1"  height="16" rx="0.5" />
                <rect x="16"  y="4" width="3"   height="16" rx="0.5" />
                <rect x="21"  y="4" width="2"   height="16" rx="0.5" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">No barcodes yet</h3>
            <p className="text-sm text-slate-400">
              Configure the settings above and click Generate
            </p>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────── */}
        {(barcodes.length > 0 || isGenerating) && (
          <div>
            {/* Stats + download bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isGenerating ? 'Generating…' : `${barcodes.length} Barcodes Ready`}
                </h2>
                {barcodes.length > 1 && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {barcodes[0].value} → {barcodes[barcodes.length - 1].value}
                  </p>
                )}
              </div>

              {barcodes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <ActionBtn onClick={exportCSV} variant="ghost">
                    Export CSV
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => downloadAll('svg')}
                    disabled={!!bulkLoading}
                    variant="dark"
                  >
                    {bulkLoading === 'svg' ? 'Preparing…' : '↓ All SVG (ZIP)'}
                  </ActionBtn>
                  <ActionBtn
                    onClick={() => downloadAll('png')}
                    disabled={!!bulkLoading}
                    variant="indigo"
                  >
                    {bulkLoading === 'png' ? 'Converting…' : '↓ All PNG (ZIP)'}
                  </ActionBtn>
                </div>
              )}
            </div>

            {/* Grid */}
            {barcodes.length > 0 && (
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}
              >
                {barcodes.map((bc) => (
                  <BarcodeCard key={bc.value} barcode={bc} onDownload={downloadSingle} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global input style injected via a style tag */}
      <style>{`
        .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1.5px solid #cbd5e1;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #6366f1; }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

function ActionBtn({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant: 'ghost' | 'dark' | 'indigo'
  children: React.ReactNode
}) {
  const styles: Record<string, React.CSSProperties> = {
    ghost: { background: 'white', border: '1.5px solid #e2e8f0', color: '#475569' },
    dark:  { background: '#1e293b', border: 'none', color: 'white' },
    indigo: {
      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      border: 'none',
      color: 'white',
    },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '9px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function BarcodeCard({
  barcode,
  onDownload,
}: {
  barcode: BarcodeData
  onDownload: (b: BarcodeData, type: 'svg' | 'png') => void
}) {
  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 4px 16px rgba(99,102,241,0.12)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
      }}
    >
      {/* Barcode SVG */}
      <div
        className="flex items-center justify-center p-3 bg-white overflow-hidden"
        dangerouslySetInnerHTML={{ __html: barcode.svgString }}
      />

      {/* Footer */}
      <div className="px-3 pb-3 pt-1">
        <p className="text-center text-xs font-mono font-semibold text-slate-600 mb-2 tracking-wide truncate">
          {barcode.value}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => onDownload(barcode, 'svg')}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            SVG
          </button>
          <button
            onClick={() => onDownload(barcode, 'png')}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors"
            style={{
              background: '#ede9fe',
              color: '#6d28d9',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            PNG
          </button>
        </div>
      </div>
    </div>
  )
}
