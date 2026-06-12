'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

interface ScanResult {
  id: number
  value: string
  format: string
  time: string
}

export default function BarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [scanning, setScanning] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [results, setResults] = useState<ScanResult[]>([])
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [permissionState, setPermissionState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const counterRef = useRef(0)
  const lastValueRef = useRef<string>('')
  const pauseRef = useRef(false)

  // Request permission then enumerate cameras
  const requestPermissionAndLoadCameras = useCallback(async () => {
    setPermissionState('requesting')
    setError(null)
    try {
      // getUserMedia triggers the browser permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Stop immediately — we only needed the prompt
      stream.getTracks().forEach((t) => t.stop())
      setPermissionState('granted')
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      setCameras(devices)
      if (devices.length > 0) setSelectedCamera(devices[0].deviceId)
    } catch (e: unknown) {
      setPermissionState('denied')
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Camera access was denied. Please allow camera access in your browser settings and try again.')
      } else {
        setError(`Could not access camera: ${msg}`)
      }
    }
  }, [])

  // Try silent enumeration on mount (works if permission was already granted)
  useEffect(() => {
    if (!navigator.mediaDevices) return
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        // Browsers return devices with empty labels when permission is not yet granted
        const hasRealDevices = devices.some((d) => d.deviceId && d.deviceId !== '')
        if (hasRealDevices) {
          setCameras(devices)
          setSelectedCamera(devices[0].deviceId)
          setPermissionState('granted')
        }
      })
      .catch(() => {/* will ask on click */})
  }, [])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
    setPaused(false)
    pauseRef.current = false
  }, [])

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return
    setError(null)
    lastValueRef.current = ''

    // If we don't have camera access yet, request it first
    if (permissionState !== 'granted' || cameras.length === 0) {
      await requestPermissionAndLoadCameras()
      // startScanner will be called again once cameras are loaded via the button
      return
    }

    const deviceId = selectedCamera || cameras[0]?.deviceId
    if (!deviceId) {
      setError('No camera found on this device.')
      return
    }

    try {
      readerRef.current = new BrowserMultiFormatReader()
      const controls = await readerRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, err) => {
          if (pauseRef.current) return
          if (result) {
            const value = result.getText()
            const format = result.getBarcodeFormat().toString()
            if (value === lastValueRef.current) return
            lastValueRef.current = value
            setTimeout(() => { lastValueRef.current = '' }, 1500)

            setLastScan(value)
            setResults((prev) => [
              { id: ++counterRef.current, value, format, time: new Date().toLocaleTimeString() },
              ...prev.slice(0, 49),
            ])
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn('Scan error:', err)
          }
        }
      )
      controlsRef.current = controls
      setScanning(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Camera error: ${msg}`)
    }
  }, [selectedCamera, cameras, permissionState, requestPermissionAndLoadCameras])

  const togglePause = () => {
    pauseRef.current = !pauseRef.current
    setPaused(pauseRef.current)
  }

  const clearResults = () => {
    setResults([])
    setLastScan(null)
  }

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value).catch(() => {})
  }

  const exportCSV = () => {
    if (!results.length) return
    const lines = ['Value,Format,Time', ...results.map((r) => `${r.value},${r.format},${r.time}`)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scanned-barcodes.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 200)
  }

  // Cleanup on unmount
  useEffect(() => () => { controlsRef.current?.stop() }, [])

  return (
    <div className="space-y-6">
      {/* Camera controls */}
      <div
        className="bg-white rounded-2xl p-7"
        style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
      >
        <h2 className="text-base font-semibold text-slate-800 mb-5">Scanner</h2>

        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Camera
            </label>
            <select
              value={selectedCamera}
              onChange={(e) => {
                stopScanner()
                setSelectedCamera(e.target.value)
              }}
              disabled={scanning}
              className="input bg-white"
            >
              {cameras.length === 0
                ? <option value="">{permissionState === 'granted' ? 'No cameras found' : 'Click Start Scanning to allow access'}</option>
                : cameras.map((cam, idx) => (
                    <option key={cam.deviceId || `cam-${idx}`} value={cam.deviceId}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))
              }
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              &nbsp;
            </label>
            {!scanning ? (
              <button
                onClick={startScanner}
                disabled={permissionState === 'requesting'}
                className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{
                  background: permissionState === 'denied'
                    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : 'linear-gradient(135deg,#22c55e,#16a34a)',
                  boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
                  cursor: permissionState === 'requesting' ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {permissionState === 'requesting'
                  ? 'Requesting…'
                  : permissionState === 'denied'
                    ? 'Retry Access'
                    : permissionState === 'granted' && cameras.length === 0
                      ? 'No Camera Found'
                      : 'Start Scanning'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={togglePause}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: paused ? '#fef3c7' : '#f1f5f9',
                    color: paused ? '#92400e' : '#475569',
                    border: '1.5px solid ' + (paused ? '#fde68a' : '#e2e8f0'),
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={stopScanner}
                  className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold"
                  style={{
                    background: '#ef4444',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            className="mt-4 px-4 py-3 rounded-lg text-sm text-red-700"
            style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Viewfinder */}
      <div
        className="relative overflow-hidden rounded-2xl bg-black"
        style={{
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          aspectRatio: '16/9',
          maxHeight: 420,
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ display: 'block' }}
          muted
          playsInline
        />

        {/* Overlay when not scanning */}
        {!scanning && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'rgba(15,23,42,0.85)' }}
          >
            <div
              className="mb-4 flex items-center justify-center rounded-2xl"
              style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.08)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8V5a1 1 0 0 1 1-1h3" />
                <path d="M22 8V5a1 1 0 0 0-1-1h-3" />
                <path d="M2 16v3a1 1 0 0 0 1 1h3" />
                <path d="M22 16v3a1 1 0 0 1-1 1h-3" />
                <rect x="1" y="9" width="3" height="6" rx="0.4" fill="#94a3b8" />
                <rect x="6" y="9" width="1.5" height="6" rx="0.4" fill="#94a3b8" />
                <rect x="9" y="9" width="2.5" height="6" rx="0.4" fill="#94a3b8" />
                <rect x="13.5" y="9" width="1" height="6" rx="0.4" fill="#94a3b8" />
                <rect x="16" y="9" width="3" height="6" rx="0.4" fill="#94a3b8" />
                <rect x="21" y="9" width="2" height="6" rx="0.4" fill="#94a3b8" />
              </svg>
            </div>
            <p className="text-slate-300 text-sm font-medium">Camera inactive</p>
            <p className="text-slate-500 text-xs mt-1">Press Start Scanning to begin</p>
          </div>
        )}

        {/* Scanning indicator */}
        {scanning && (
          <>
            {/* Corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative" style={{ width: 240, height: 120 }}>
                {/* TL */}
                <div className="absolute top-0 left-0 w-8 h-8" style={{ borderTop: '3px solid #6366f1', borderLeft: '3px solid #6366f1', borderRadius: '4px 0 0 0' }} />
                {/* TR */}
                <div className="absolute top-0 right-0 w-8 h-8" style={{ borderTop: '3px solid #6366f1', borderRight: '3px solid #6366f1', borderRadius: '0 4px 0 0' }} />
                {/* BL */}
                <div className="absolute bottom-0 left-0 w-8 h-8" style={{ borderBottom: '3px solid #6366f1', borderLeft: '3px solid #6366f1', borderRadius: '0 0 0 4px' }} />
                {/* BR */}
                <div className="absolute bottom-0 right-0 w-8 h-8" style={{ borderBottom: '3px solid #6366f1', borderRight: '3px solid #6366f1', borderRadius: '0 0 4px 0' }} />
                {/* Scan line */}
                {!paused && (
                  <div
                    className="absolute left-0 right-0 h-0.5"
                    style={{
                      background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                      animation: 'scanLine 2s ease-in-out infinite',
                      top: '50%',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Status pill */}
            <div className="absolute top-3 left-3">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: paused ? 'rgba(234,179,8,0.9)' : 'rgba(34,197,94,0.9)',
                  color: 'white',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 6, height: 6,
                    background: 'white',
                    animation: paused ? 'none' : 'pulse 1s ease-in-out infinite',
                  }}
                />
                {paused ? 'Paused' : 'Scanning…'}
              </div>
            </div>
          </>
        )}

        {/* Last scan flash */}
        {lastScan && scanning && !paused && (
          <div
            className="absolute bottom-3 left-3 right-3"
            key={results[0]?.id}
          >
            <div
              className="px-4 py-2 rounded-xl text-sm font-mono font-bold text-white truncate"
              style={{
                background: 'rgba(99,102,241,0.92)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
              }}
            >
              ✓ {lastScan}
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Scanned Barcodes</h3>
              <p className="text-xs text-slate-400 mt-0.5">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#f1f5f9', color: '#475569', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}
              >
                Export CSV
              </button>
              <button
                onClick={clearResults}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {results.map((r, idx) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-6 py-3"
                style={{
                  borderBottom: idx < results.length - 1 ? '1px solid #f8fafc' : 'none',
                  background: idx === 0 ? '#fafffe' : 'white',
                }}
              >
                <span
                  className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: '#ede9fe', color: '#6d28d9' }}
                >
                  {r.format}
                </span>
                <span className="flex-1 font-mono text-sm text-slate-800 truncate">{r.value}</span>
                <span className="flex-shrink-0 text-xs text-slate-400">{r.time}</span>
                <button
                  onClick={() => copyValue(r.value)}
                  title="Copy to clipboard"
                  className="flex-shrink-0 p-1.5 rounded-md transition-colors"
                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Scanned barcodes will appear here</p>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; }
          50%  { top: 90%; }
          100% { top: 10%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
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
