"use client"

import { useState, useRef, useEffect } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface OrderSummaryProps {
  orderSummary: {
    user?: string;
    orders: Array<{
      day: string
      counts: {
        [option: string]: number
      }
      comments: string[]
    }>
  }
}

export default function OrderSummary({ orderSummary }: OrderSummaryProps) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const contentRef = useRef<HTMLDivElement>(null)

  // Actualizar la hora de la última actualización cuando cambia el resumen
  useEffect(() => {
    setLastUpdate(new Date());
  }, [orderSummary]);

  // Formato de fecha y hora para la última actualización
  const getFormattedLastUpdate = () => {
    return lastUpdate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getFormattedMessage = () => {
    const today = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })

    const lines = [
      `► Resumen de Pedidos${orderSummary.user ? ` - ${orderSummary.user}` : ''}`,
      `► Fecha: ${today}`,
      '',
      ...orderSummary.orders.map(order => {
        const dayLines = [`► ${order.day.toUpperCase()}`]
        
        // Agregar conteo de cada opción
        Object.entries(order.counts)
          .filter(([, count]) => count > 0) // Solo mostrar opciones con pedidos
          .forEach(([option, count]) => {
            dayLines.push(`  • ${option}: ${count}`)
          })

        // Agregar el total del día
        const dayTotal = Object.values(order.counts).reduce((sum, count) => sum + count, 0)
        dayLines.push(`  ► Total del día: ${dayTotal}`)

        // Agregar comentarios si existen
        if (order.comments.length > 0) {
          dayLines.push('', '  ► Notas especiales:')
          order.comments.forEach(comment => {
            dayLines.push(`    • ${comment}`)
          })
        }

        return dayLines.join('\n')
      })
    ]

    // Agregar total general
    const totalGeneral = orderSummary.orders.reduce((sum, order) => 
      sum + Object.values(order.counts).reduce((daySum, count) => daySum + count, 0), 0
    )
    lines.push('', `► TOTAL GENERAL: ${totalGeneral} pedidos`)

    return lines.join('\n\n')
  }

  const handleCopy = async () => {
    const text = getFormattedMessage()
    try {
      // Intentar usar el API moderno del portapapeles
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }

      // Fallback para navegadores que no soportan el API moderno
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        document.execCommand('copy')
        textArea.remove()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Error al copiar (fallback):', error)
        textArea.remove()
        alert('No se pudo copiar al portapapeles. Por favor, copia el texto manualmente.')
      }
    } catch (err) {
      console.error('Error al copiar:', err)
      alert('No se pudo copiar al portapapeles. Por favor, copia el texto manualmente.')
    }
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(getFormattedMessage())
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleExportPDF = async () => {
    if (!contentRef.current) return
    
    setExporting(true)
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`pedidos-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error al exportar PDF:', error)
      alert('Error al generar el PDF. Por favor, intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50 rounded-2xl shadow-lg p-8 border border-blue-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-900 mb-4">
            Resumen de Pedidos
            {orderSummary.user && (
              <span className="ml-2 text-lg font-medium text-blue-600">
                - {orderSummary.user}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-gray-500 text-sm">
              Total de pedidos por día y opción
            </p>
            <div className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Actualización en vivo</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Última actualización: {getFormattedLastUpdate()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2.5 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow flex items-center gap-2 text-sm font-medium"
          >
            {showPreview ? '👁️ Ocultar vista' : '👁️ Mostrar vista'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-medium disabled:opacity-50"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Guardar PDF</span>
              </>
            )}
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-medium"
          >
            <span>Compartir</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17 13H13V17H11V13H7V11H11V7H13V11H17V13Z"/>
            </svg>
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm font-medium ${
              copied 
                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <span>{copied ? '¡Copiado!' : 'Copiar pedido'}</span>
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div ref={contentRef}>
        {showPreview && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-inner border border-blue-100 font-mono whitespace-pre-wrap transition-all duration-300 hover:shadow-md">
            {getFormattedMessage()}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {orderSummary.orders.map((order, index) => {
            const dayTotal = Object.values(order.counts).reduce((sum, count) => sum + count, 0)
            if (dayTotal === 0) return null

            return (
              <div key={index} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{order.day}</h3>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                    {dayTotal} pedidos
                  </span>
                </div>
                <div className="space-y-2">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opción</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {Object.entries(order.counts)
                        .filter(([, count]) => count > 0) // Filter out options with 0 count
                        .map(([option, count]) => (
                          <tr key={option}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{option}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 text-right font-medium">{count}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                  {order.comments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Notas especiales:</h4>
                      <ul className="space-y-1">
                        {order.comments.map((comment, i) => (
                          <li key={i} className="text-sm text-gray-600">• {comment}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-900">Total General</span>
              <span className="text-lg font-bold text-blue-900">
                {orderSummary.orders.reduce((sum, order) => 
                  sum + Object.values(order.counts).reduce((daySum, count) => daySum + count, 0), 0
                )} pedidos
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Comentarios Generales</h3>
          {orderSummary.orders.flatMap(order => order.comments).length > 0 ? (
            <ul className="space-y-2">
              {orderSummary.orders.flatMap(order => order.comments).map((comment, index) => (
                <li key={index} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {comment}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No hay comentarios generales para esta semana.</p>
          )}
        </div>
      </div>
    </div>
  )
}

