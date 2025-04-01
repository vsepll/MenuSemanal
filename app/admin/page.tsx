"use client"

import { useState } from 'react'
import Link from 'next/link'

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sendSummaryEmail = async () => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)

      // Llamar a nuestra API con el parámetro force=true para ignorar la restricción de tiempo
      const response = await fetch('/api/send-summary?force=true')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar el resumen')
      }

      setResult(data)
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 mb-4">
            Panel de Administración
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Funciones administrativas del Sistema de Pedidos de Comida.
          </p>
        </header>

        <div className="mb-8 flex justify-end">
          <Link 
            href="/" 
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Inicio
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <section className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 rounded-xl">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Envío de Resumen por Correo</h2>
                <p className="text-sm text-gray-500">Envía manualmente el resumen de pedidos actual por correo electrónico</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl text-blue-700 text-sm">
                <p>
                  <strong>Nota:</strong> En producción, este proceso se ejecutará automáticamente cada viernes a las 16:00 hs.
                  Este botón es solo para fines de prueba.
                </p>
              </div>

              <button
                onClick={sendSummaryEmail}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Enviar Resumen Ahora</span>
                  </>
                )}
              </button>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl">
                  <p className="font-medium">Error:</p>
                  <p>{error}</p>
                </div>
              )}

              {result && (
                <div className="p-4 bg-green-50 text-green-700 rounded-xl">
                  <p className="font-medium">¡Correo enviado exitosamente!</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer">Ver detalles del resumen</summary>
                    <pre className="mt-2 p-2 bg-white text-xs overflow-auto max-h-60 rounded">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
} 