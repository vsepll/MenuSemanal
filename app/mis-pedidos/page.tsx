"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

interface DayOrderSummary {
  day: string;
  counts: { [option: string]: number };
  comments: string[];
}

interface UserOrderSummary {
  user: string | null;
  orders: DayOrderSummary[];
}

interface OrdersByDay {
  [day: string]: {
    counts: { [option: string]: number };
    comments: string[];
  }
}

export default function MyOrders() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [orderSummary, setOrderSummary] = useState<UserOrderSummary>({ user: null, orders: [] })
  const [loading, setLoading] = useState(true)

  // Obtener la fecha de inicio de la semana actual
  const getWeekStart = () => {
    const now = new Date()
    // Si es viernes después de las 00:00, consideramos que es para la próxima semana
    if (now.getDay() === 5) {
      // Avanzamos al próximo lunes
      const nextMonday = new Date(now)
      nextMonday.setDate(now.getDate() + 3) // +3 días desde el viernes llega al lunes
      return nextMonday.toISOString().split('T')[0]
    } else {
      // Para cualquier otro día, usamos el lunes de la semana actual
      const dayOfWeek = now.getDay()
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      return new Date(now.setDate(diff)).toISOString().split('T')[0]
    }
  }

  // Función para cargar los pedidos del usuario (envuelta en useCallback)
  const loadUserOrders = useCallback(async (user: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      const weekStart = getWeekStart();
      console.log(`Cargando pedidos del usuario: ${user} para la semana: ${weekStart}`);
      
      const { data, error } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('week_start', weekStart)
        .eq('user_name', user);

      if (error) throw error;

      if (data && data.length > 0) {
        console.log("Pedidos encontrados del usuario:", data.length);
        
        // Organizar los pedidos por día usando la interfaz
        const ordersByDay: OrdersByDay = {};
        
        data.forEach(order => {
          if (!ordersByDay[order.day]) {
            ordersByDay[order.day] = {
              counts: {},
              comments: []
            };
          }
          
          ordersByDay[order.day].counts[order.option] = order.count;
          
          if (order.comments && Array.isArray(order.comments)) {
            ordersByDay[order.day].comments = [...ordersByDay[order.day].comments, ...order.comments];
          }
        });
        
        const formattedSummary = {
          user: user,
          orders: Object.entries(ordersByDay).map(([day, data]) => ({
            day,
            counts: data.counts,
            comments: data.comments
          }))
        };
        
        setOrderSummary(formattedSummary);
      } else {
        console.log("No se encontraron pedidos para el usuario");
        setOrderSummary({
          user: user,
          orders: []
        });
      }
    } catch (error) {
      console.error("Error al cargar pedidos:", error);
    } finally {
      setLoading(false);
    }
  }, []); // <-- Dependencies for useCallback (empty for now, adjust if needed)

  // Cargar el usuario desde localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('comidaUser')
    if (savedUser) {
      setCurrentUser(savedUser)
    }
    setLoading(false)
  }, [])
  
  // Observar cambios en la semana seleccionada
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customWeekStart' && e.newValue !== e.oldValue) {
        console.log("Se detectó un cambio en la semana seleccionada. Recargando pedidos...");
        if (currentUser) {
          loadUserOrders(currentUser);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser, loadUserOrders]);

  // Cargar los pedidos del usuario
  useEffect(() => {
    if (!currentUser) return;
    loadUserOrders(currentUser);
  }, [currentUser, loadUserOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <span className="text-lg font-medium">Cargando pedidos...</span>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-12">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
            <div className="p-3 bg-yellow-50 rounded-full inline-flex mb-4">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Necesitas identificarte
            </h2>
            <p className="text-gray-600 mb-6">
              Para ver tus pedidos, primero debes seleccionar tu nombre en la página principal.
            </p>
            <Link 
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
            >
              Ir a la página principal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Pedidos</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Semana activa:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {getWeekStart()}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => loadUserOrders(currentUser!)}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recargar
            </button>
          </div>
        </div>

        {orderSummary.orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
            <div className="p-3 bg-blue-50 rounded-full inline-flex mb-4">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              No tienes pedidos aún
            </h2>
            <p className="text-gray-600 mb-6">
              Parece que aún no has hecho ningún pedido esta semana.
            </p>
            <Link 
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
            >
              Ir a hacer pedidos
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Resumen de tus pedidos para esta semana
            </h2>
            
            <div className="space-y-6">
              {orderSummary.orders.map((dayOrder: DayOrderSummary) => (
                <div key={dayOrder.day} className="border border-gray-100 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-3">{dayOrder.day}</h3>
                  
                  <div className="space-y-2">
                    {Object.entries(dayOrder.counts).map(([option, count]: [string, number]) => (
                      count > 0 && (
                        <div key={option} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-800">{option}</span>
                          <span className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {count}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                  
                  {dayOrder.comments && dayOrder.comments.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Comentarios:</h4>
                      <div className="space-y-1">
                        {dayOrder.comments.map((comment: string, i: number) => (
                          <div key={i} className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                            {comment}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 