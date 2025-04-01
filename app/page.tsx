"use client"

import { useState, useEffect, useRef } from "react"
import OrderForm from "@/components/OrderForm"
import OrderSummary from "@/components/OrderSummary"
import ExcelUploader from "@/components/ExcelUploader"
import UserSelector from "@/components/UserSelector"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface OrderSummaryType {
  orders: Array<{
    day: string
    counts: {
      [option: string]: number
    }
    comments: string[]
  }>
}

interface MenuDataType {
  [key: string]: string[]
}

const defaultMenuData: MenuDataType = {
  "Lunes": ["Opción 1", "Opción 2", "Opción 3"],
  "Martes": ["Opción 1", "Opción 2", "Opción 3"],
  "Miércoles": ["Opción 1", "Opción 2", "Opción 3"],
  "Jueves": ["Opción 1", "Opción 2", "Opción 3"],
  "Viernes": ["Opción 1", "Opción 2", "Opción 3"]
}

const dayMappings = {
  "LUNES": "Lunes",
  "MARTES": "Martes",
  "MIERCOLES": "Miércoles",
  "MIÉRCOLES": "Miércoles",
  "JUEVES": "Jueves",
  "VIERNES": "Viernes"
}

export default function Home() {
  const [menuData, setMenuData] = useState<MenuDataType>(defaultMenuData)
  const [orderSummary, setOrderSummary] = useState<OrderSummaryType | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [showUploader, setShowUploader] = useState(false)
  const loadingMenuRef = useRef<boolean>(false)

  const setMenuDataWithTracking = (data: MenuDataType, id?: number) => {
    console.log("Actualizando menú localmente, ID:", id || "local")
    setMenuData(data)
  }

  const loadLatestMenu = async () => {
    if (loadingMenuRef.current) {
      console.log("Ya hay una carga de menú en progreso, omitiendo");
      return;
    }
    
    loadingMenuRef.current = true;
    
    try {
      console.log("Cargando el menú más reciente desde la base de datos...")
      
      let fallbackMenu = null;
      try {
        const savedMenu = localStorage.getItem('cachedMenu');
        if (savedMenu) {
          fallbackMenu = JSON.parse(savedMenu);
          console.log("Se encontró menú en caché local que se usará si falla la conexión");
        }
      } catch (e) {
        console.error("Error al leer menú de localStorage:", e);
      }
      
      const { data, error } = await supabase
        .from('weekly_menus')
        .select('id, menu_data, week_start, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error("Error al cargar menú de Supabase:", error);
        
        if (fallbackMenu) {
          console.log("Usando menú en caché debido a error de conexión");
          setMenuDataWithTracking(fallbackMenu);
          setLoading(false);
          loadingMenuRef.current = false;
          return;
        }
        
        throw error;
      }

      if (data && data.length > 0) {
        console.log("Menú más reciente encontrado con ID:", data[0].id, "fecha:", data[0].week_start, "actualizado:", data[0].updated_at)
        const receivedData = data[0].menu_data
        console.log("Datos del menú recibidos:", JSON.stringify(receivedData));
        const processedData: MenuDataType = {}

        Object.entries(receivedData).forEach(([key, value]) => {
          const normalizedKey = key.toUpperCase();
          console.log(`Procesando día: ${key} -> ${normalizedKey}`);
          const normalizedDay = dayMappings[normalizedKey as keyof typeof dayMappings]
          
          if (normalizedDay && Array.isArray(value)) {
            processedData[normalizedDay] = value
            console.log(`Día ${normalizedDay} procesado con ${value.length} opciones:`, value);
          } else {
            console.warn(`No se pudo procesar el día ${key}. Día normalizado: ${normalizedDay}, Es array: ${Array.isArray(value)}`);
          }
        })

        if (Object.keys(processedData).length > 0) {
          console.log("Menú procesado correctamente con", Object.keys(processedData).length, "días:", Object.keys(processedData));
          setMenuDataWithTracking(processedData, data[0].id);
          
          try {
            localStorage.setItem('cachedMenu', JSON.stringify(processedData));
            localStorage.setItem('menuLastUpdated', new Date().toISOString());
          } catch (e) {
            console.error("Error al guardar menú en localStorage:", e);
          }
        } else {
          console.warn("El menú encontrado no tiene datos válidos, manteniendo el menú por defecto");
        }
      } else {
        console.log("No se encontraron menús en la base de datos, se usará el menú por defecto")
      }
    } catch (error) {
      console.error('Error loading menu:', error)
    } finally {
      loadingMenuRef.current = false;
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLatestMenu()
    
    const verifyConnection = async () => {
      try {
        console.log("Verificando conexión con Supabase...");
        
        const { error } = await supabase
          .from('menu_orders')
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          console.error("Error de conexión con Supabase:", error);
        } else {
          console.log("Conexión a Supabase establecida correctamente");
          
          const hasSavedState = localStorage.getItem('hasOrderData');
          
          if (hasSavedState === 'true') {
            console.log("Se detectaron datos de pedidos guardados. Forzando actualización de resumen...");
            const orderForm = document.querySelector('[data-refresh-summary]');
            if (orderForm) {
              const refreshButton = orderForm.querySelector('[data-refresh-button]');
              if (refreshButton) {
                (refreshButton as HTMLElement).click();
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al verificar la conexión:", error);
      }
    };
    
    const timer = setTimeout(() => {
      verifyConnection();
    }, 2000);
    
    return () => {
      clearTimeout(timer);
    }
  }, [loadLatestMenu])

  const handleUserSelect = (userName: string) => {
    setCurrentUser(userName)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <span className="text-lg font-medium">Cargando menú...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 mb-4">
            Sistema de Pedidos de Comida
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Gestiona los pedidos de comida semanales de manera eficiente y organizada. 
            Carga el menú, selecciona tus opciones y comparte fácilmente.
          </p>
        </header>

        <div className="mb-10">
          <UserSelector onSelectUser={handleUserSelect} />
        </div>

        {currentUser && (
          <div className="mb-8 flex justify-end gap-4">
            <Link 
              href="/mis-pedidos" 
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Ver Mis Pedidos
            </Link>
            
            <Link 
              href="/admin" 
              className="px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Administración
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Cargar Menú Semanal</h2>
                    <p className="text-sm text-gray-500">Sube el archivo Excel con las opciones del menú</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={async () => {
                      try {
                        const { data: weeksData, error: weeksError } = await supabase
                          .from('menu_orders')
                          .select('week_start')
                          .order('week_start', { ascending: false });
                        
                        if (weeksError) throw weeksError;
                        
                        const uniqueWeeks = Array.from(new Set(weeksData?.map(item => item.week_start) || []));
                        
                        const now = new Date();
                        const dayOfWeek = now.getDay();
                        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                        const currentWeek = new Date(now.setDate(diff)).toISOString().split('T')[0];
                        
                        const { count, error: countError } = await supabase
                          .from('menu_orders')
                          .select('*', { count: 'exact', head: true })
                          .eq('week_start', currentWeek);
                        
                        if (countError) throw countError;
                        
                        alert(`Diagnóstico de semanas:\n\nSemana actual calculada: ${currentWeek}\nRegistros en semana actual: ${count || 0}\n\nSemanas disponibles en Supabase:\n${uniqueWeeks.join('\n')}`);
                        
                      } catch (e) {
                        const error = e as Error;
                        console.error("Error en diagnóstico:", error);
                        alert("Error al realizar diagnóstico: " + (error.message || "Error desconocido"));
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Diagnóstico</span>
                  </button>
                  <button 
                    onClick={() => loadLatestMenu()} 
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Actualizar Menú</span>
                  </button>
                  <button 
                    onClick={() => setShowUploader(!showUploader)} 
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>{showUploader ? 'Ocultar Cargador' : 'Mostrar Cargador'}</span>
                  </button>
                </div>
              </div>
              {showUploader && <ExcelUploader setMenuData={setMenuDataWithTracking} onMenuUploaded={loadLatestMenu} />}
            </section>

            <section className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-green-50 rounded-xl">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Realizar Pedido</h2>
                  <p className="text-sm text-gray-500">Selecciona tus opciones para cada día</p>
                </div>
              </div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                <div className="flex gap-2 items-center">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Importante: Al cargar un nuevo menú semanal, todos los contadores de pedidos se reiniciarán automáticamente a cero.
                  </span>
                </div>
              </div>
              <OrderForm menuData={menuData} setOrderSummary={setOrderSummary} currentUser={currentUser} />
            </section>
          </div>

          <div className="lg:sticky lg:top-8 self-start">
            {orderSummary && (
              <OrderSummary orderSummary={orderSummary} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
