"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { supabase } from "../lib/supabase"

interface MenuDataType {
  [key: string]: string[]
}

const dayMappings = {
  "LUNES": "Lunes",
  "MARTES": "Martes",
  "MIERCOLES": "Miércoles",
  "MIÉRCOLES": "Miércoles",
  "JUEVES": "Jueves",
  "VIERNES": "Viernes"
}

interface ExcelUploaderProps {
  setMenuData: (data: MenuDataType, id?: number) => void
  onMenuUploaded?: () => Promise<void>
}

export default function ExcelUploader({ setMenuData, onMenuUploaded }: ExcelUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getWeekStart = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  }

  const processExcelData = (data: any[]): MenuDataType => {
    const orderedDays = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"]
    const rawData: { [key: string]: string[] } = {}

    // Inicializar todos los días con arrays vacíos
    orderedDays.forEach(day => {
      rawData[day] = []
    })

    console.log("Procesando datos del Excel:", data);

    // Procesar los datos del Excel
    orderedDays.forEach((day, index) => {
      const dayRow = data[index + 2] // +2 porque los datos empiezan en la fila 3 (índice 2)
      if (dayRow) {
        console.log(`Procesando día ${day}, datos:`, dayRow);
        const dayOptions = dayRow.slice(1).filter(Boolean) // Las opciones empiezan desde la segunda columna
        if (dayOptions.length > 0) {
          // Asegurarse de que todas las opciones sean strings
          rawData[day] = dayOptions.map((option: any) => String(option).trim())
          console.log(`Opciones para ${day}:`, rawData[day]);
        } else {
          console.warn(`No se encontraron opciones válidas para el día ${day}`);
        }
      } else {
        console.warn(`No se encontró fila para el día ${day}`);
      }
    })

    // Convertir las claves de días al formato correcto
    const processedData: MenuDataType = {}
    Object.entries(rawData).forEach(([key, value]) => {
      const normalizedKey = key.toUpperCase();
      console.log(`Normalizando clave: ${normalizedKey}`);
      const normalizedDay = dayMappings[normalizedKey as keyof typeof dayMappings]
      if (normalizedDay) {
        processedData[normalizedDay] = value
        console.log(`Asignado ${value.length} opciones a ${normalizedDay}`);
      } else {
        console.warn(`No se pudo mapear el día ${normalizedKey}`);
      }
    })

    // Validar que al menos un día tenga opciones
    const hasOptions = Object.values(processedData).some(options => options.length > 0)
    if (!hasOptions) {
      throw new Error("El archivo Excel no contiene opciones de menú válidas")
    }

    // Log final para depuración
    console.log('Datos procesados del Excel:', JSON.stringify(processedData));
    return processedData
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return
    }

    const file = e.target.files[0]
    setFile(file)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        setUploading(true)
        if (!e.target?.result) {
          throw new Error("Error al leer el archivo")
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        const processedData = processExcelData(jsonData)
        console.log('Datos procesados del Excel:', processedData)
        
        // Actualizar el estado local primero (sin ID todavía)
        // Esto proporciona retroalimentación inmediata al usuario
        setMenuData(processedData)

        // Luego guardar en Supabase
        const weekStart = getWeekStart()
        const timestamp = new Date().toISOString()
        console.log("Guardando menu con fecha:", weekStart, "timestamp:", timestamp)
        
        try {
          // Solo usar columnas que existan en la base de datos
          const { data: responseData, error: supabaseError } = await supabase
            .from("weekly_menus")
            .insert({
              menu_data: processedData,
              week_start: weekStart,
              updated_at: timestamp
            })
            .select('id')

          if (supabaseError) {
            throw supabaseError
          }

          // Si tenemos el ID, actualizar con seguimiento
          if (responseData && responseData[0] && responseData[0].id) {
            const newId = responseData[0].id
            console.log("Menú guardado con ID:", newId)
            
            // Limpiar pedidos antiguos para asegurar el reinicio a 0
            try {
              console.log("Limpiando pedidos anteriores para reiniciar contadores...")
              const { error: deleteError } = await supabase
                .from('menu_orders')
                .delete()
                .eq('week_start', weekStart)
                
              if (deleteError) {
                console.error("Error al limpiar pedidos antiguos:", deleteError)
              } else {
                console.log("Pedidos antiguos eliminados correctamente")
              }
              
              // También eliminar el resumen general para reiniciarlo
              console.log("Eliminando resumen general para reiniciar a cero...")
              const { error: deleteSummaryError } = await supabase
                .from('order_summaries')
                .delete()
                .eq('week_start', weekStart)
                .eq('user_name', 'general')
                
              if (deleteSummaryError) {
                console.error("Error al eliminar resumen general:", deleteSummaryError)
              } else {
                console.log("Resumen general eliminado correctamente")
              }
            } catch (cleanError) {
              console.error("Error al limpiar pedidos:", cleanError)
            }
            
            // Actualizar inmediatamente para asegurar que este dispositivo tenga el ID correcto
            setMenuData(processedData, newId)
            
            // Después de guardar, recargar el menú más reciente
            if (onMenuUploaded) {
              console.log("Recargando menú más reciente después de guardar");
              await onMenuUploaded();
            }
            
          } else {
            console.error("No se recibió ID después de guardar el menú")
          }
        } catch (dbError) {
          console.error("Error al guardar en la base de datos:", dbError)
          throw dbError
        }

      } catch (error) {
        console.error("Error processing or saving data:", error)
        setError(error instanceof Error ? error.message : "Error desconocido")
      } finally {
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="mb-4">
      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        disabled={uploading}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      {file && <p className="mt-2 text-sm text-gray-500">Archivo cargado: {file.name}</p>}
      {uploading && <p className="mt-2 text-sm text-blue-500">Subiendo datos...</p>}
      {error && <p className="mt-2 text-sm text-red-500">Error: {error}</p>}
    </div>
  )
}

