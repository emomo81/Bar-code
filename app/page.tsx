'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const BarcodeGenerator = dynamic(() => import('./components/BarcodeGenerator'), { ssr: false })
const BarcodeScanner = dynamic(() => import('./components/BarcodeScanner'), { ssr: false })

type Tab = 'generate' | 'scan'

export default function Home() {
  const [tab, setTab] = useState<Tab>('generate')

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <rect x="1"    y="4" width="3"   height="16" rx="0.4" />
              <rect x="6"    y="4" width="1.5" height="16" rx="0.4" />
              <rect x="9"    y="4" width="2.5" height="16" rx="0.4" />
              <rect x="13.5" y="4" width="1"   height="16" rx="0.4" />
              <rect x="16"   y="4" width="3"   height="16" rx="0.4" />
              <rect x="21"   y="4" width="2"   height="16" rx="0.4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Certificate Barcode Generator
            </h1>
            <p className="text-sm text-slate-500 leading-tight">
              Generate &amp; scan unique barcodes for student certificates
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1" style={{ borderTop: '1px solid #f1f5f9' }}>
            <TabButton active={tab === 'generate'} onClick={() => setTab('generate')} icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="1"    y="4" width="3"   height="16" rx="0.5" />
                <rect x="6"    y="4" width="1.5" height="16" rx="0.5" />
                <rect x="9"    y="4" width="2.5" height="16" rx="0.5" />
                <rect x="13.5" y="4" width="1"   height="16" rx="0.5" />
                <rect x="16"   y="4" width="3"   height="16" rx="0.5" />
                <rect x="21"   y="4" width="2"   height="16" rx="0.5" />
              </svg>
            }>
              Generate
            </TabButton>
            <TabButton active={tab === 'scan'} onClick={() => setTab('scan')} icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8V5a1 1 0 0 1 1-1h3" />
                <path d="M22 8V5a1 1 0 0 0-1-1h-3" />
                <path d="M2 16v3a1 1 0 0 0 1 1h3" />
                <path d="M22 16v3a1 1 0 0 1-1 1h-3" />
                <line x1="2" y1="12" x2="22" y2="12" strokeWidth="2" />
              </svg>
            }>
              Scan
            </TabButton>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'generate' ? <BarcodeGenerator hideHeader /> : <BarcodeScanner />}
      </main>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
        color: active ? '#6366f1' : '#64748b',
        marginBottom: -1,
        transition: 'color 0.15s',
      }}
    >
      {icon}
      {children}
    </button>
  )
}
