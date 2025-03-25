"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"

interface MenuData {
  [key: string]: string[]
}

interface OrderFormProps {
  menuData: MenuData
  setOrderSummary: (summary: OrderSummary) => void
  currentUser: string | null
}

interface MenuCount {
  [option: string]: number
}

interface DayOrder {
  counts: MenuCount
  comments: string[]
  isExpanded: boolean
}

interface DayOrders {
  [day: string]: DayOrder
}

interface OrderSummary {
  orders: Array<{
    day: string
    counts: MenuCount
    comments: string[]
  }>
}

interface SupabasePayload {
  new: {
    day: string
    option: string
    count: number
    comments: string[]
  }
}

interface BroadcastMessage {
  type: 'RELOAD_PAGE'
  timestamp: number
}

export default function OrderForm({ menuData, setOrderSummary, currentUser }: OrderFormProps) {
  const orderedDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
  const menuDataRef = useRef<MenuData>(menuData);
  
  // Inicializar el estado con contadores en 0 y comentarios vacíos para cada opción
  const initializeOrders = (currentMenuData: MenuData) => {
    console.log("Inicializando pedidos con nuevo menú:", Object.keys(currentMenuData).map(day => 
      `${day}: ${currentMenuData[day]?.length || 0} opciones`
    ).join(", "));
    
    return orderedDays.reduce((acc, day) => {
      acc[day] = {
        counts: (currentMenuData[day] || []).reduce((counts, option) => {
          counts[option] = 0
          return counts
        }, {} as MenuCount),
        comments: [],
        isExpanded: false
      }
      return acc
    }, {} as DayOrders);
  };

  const [orders, setOrders] = useState<DayOrders>(initializeOrders(menuData))
  const [newComment, setNewComment] = useState<string>("")
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingButtons, setLoadingButtons] = useState<{[key: string]: boolean}>({})
  const [menuResetNotification, setMenuResetNotification] = useState(false)
  const [summaryNeedsUpdate, setSummaryNeedsUpdate] = useState(false)
  const [lastGlobalUpdate, setLastGlobalUpdate] = useState<Date>(new Date())
  const lastSummaryUpdateRef = useRef<Date>(new Date());

  // Efecto para actualizar los pedidos cuando cambia el menú
  useEffect(() => {
    // Solo corre este efecto si el usuario está logueado
    if (!currentUser) return;
    
    // Verificar si hay menú guardado en localStorage para comparar
    const savedMenuHash = localStorage.getItem('menuDataHash');
    const currentMenuHash = JSON.stringify(menuData);
    
    // Solo si realmente ha cambiado el menú (comparación profunda)
    const menuChanged = JSON.stringify(menuDataRef.current) !== JSON.stringify(menuData);
    
    // Para evitar falsos positivos después de reinicios, comparamos también con localStorage
    const isRealMenuChange = menuChanged && (savedMenuHash !== null && savedMenuHash !== currentMenuHash);
    
    // Si es la primera carga o no hay hash guardado, guardamos el hash actual
    if (!savedMenuHash) {
      localStorage.setItem('menuDataHash', currentMenuHash);
    }
    
    if (isRealMenuChange) {
      console.log("El menú ha cambiado realmente, reiniciando todos los pedidos a 0");
      localStorage.setItem('menuDataHash', currentMenuHash);
      menuDataRef.current = menuData;
      
      // Reiniciar todos los pedidos a 0 cuando cambia el menú
      setOrders(initializeOrders(menuData));
      
      // Crear un resumen vacío basado en el nuevo menú
      const emptyOrderSummary = {
        orders: Object.entries(initializeOrders(menuData)).map(([day, data]) => ({
          day,
          counts: data.counts,
          comments: []
        }))
      };
      
      // Actualizar el resumen a 0 en la interfaz de usuario
      setOrderSummary(emptyOrderSummary);
      
      // Eliminar el resumen general en la base de datos
      const resetSummaryInDatabase = async () => {
        try {
          console.log("Eliminando resumen general en la base de datos...");
          
          // Eliminar el resumen general actual
          const { error: deleteError } = await supabase
            .from('order_summaries')
            .delete()
            .eq('week_start', getWeekStart())
            .eq('user_name', 'general');
            
          if (deleteError) {
            console.error("Error al eliminar el resumen general:", deleteError);
          } else {
            console.log("Resumen general eliminado correctamente");
            
            // Crear un nuevo resumen vacío en la base de datos
            if (currentUser) {
              const { error: insertError } = await supabase
                .from('order_summaries')
                .insert({
                  week_start: getWeekStart(),
                  user_name: 'general',
                  summary: emptyOrderSummary,
                  updated_by: currentUser,
                  updated_at: new Date().toISOString()
                });
                
              if (insertError) {
                console.error("Error al crear nuevo resumen vacío:", insertError);
              } else {
                console.log("Nuevo resumen vacío creado correctamente");
              }
            }
          }
        } catch (error) {
          console.error("Error al resetear el resumen:", error);
        }
      };
      
      resetSummaryInDatabase();
      
      // Mostrar notificación de reinicio
      setMenuResetNotification(true);
      // Ocultar la notificación después de 5 segundos
      setTimeout(() => setMenuResetNotification(false), 5000);
    }
  }, [menuData, currentUser]);

  // Obtener la fecha de inicio de la semana actual
  const getWeekStart = () => {
    // Verificar si hay una semana personalizada guardada en localStorage
    try {
      const customWeekStart = localStorage.getItem('customWeekStart');
      if (customWeekStart) {
        console.log("Usando semana personalizada:", customWeekStart);
        return customWeekStart;
      }
    } catch (e) {
      console.error("Error al leer semana personalizada:", e);
    }
    
    // Cálculo normal si no hay semana personalizada
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  }

  // Cargar pedidos existentes
  useEffect(() => {
    const loadOrders = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        console.log("Cargando pedidos existentes para la semana:", getWeekStart(), "usuario:", currentUser);
        
        // Intentar cargar datos de localStorage primero como respaldo
        let localOrdersLoaded = false;
        try {
          const savedOrdersData = localStorage.getItem(`orders_${getWeekStart()}_${currentUser}`);
          if (savedOrdersData) {
            const parsedOrders = JSON.parse(savedOrdersData);
            if (parsedOrders && Object.keys(parsedOrders).length > 0) {
              console.log("Se encontraron datos locales guardados, usando como respaldo inicial");
              setOrders(parsedOrders);
              localOrdersLoaded = true;
              
              // Marcar que tenemos datos de pedidos
              localStorage.setItem('hasOrderData', 'true');
            }
          }
        } catch (e) {
          console.error("Error al cargar datos locales:", e);
        }
        
        // Luego intentar cargar desde Supabase (incluso si ya cargamos de localStorage)
        const { data, error } = await supabase
          .from('menu_orders')
          .select('*')
          .eq('week_start', getWeekStart())
          .eq('user_name', currentUser);

        if (error) {
          console.error("Error al cargar pedidos desde Supabase:", error);
          // Si hay error pero ya cargamos datos locales, no mostramos error
          if (!localOrdersLoaded) {
            throw error;
          }
        } else if (data && data.length > 0) {
          console.log("Pedidos cargados desde Supabase:", data.length);
          
          // Marcar que tenemos datos de pedidos
          localStorage.setItem('hasOrderData', 'true');
          
          // Inicializar con el menú actual (todos en 0)
          const newOrders = initializeOrders(menuData);
          
          // Actualizar los valores con los datos cargados
          data.forEach(order => {
            if (newOrders[order.day] && menuData[order.day]?.includes(order.option)) {
              newOrders[order.day].counts[order.option] = order.count;
              
              // Asignar los comentarios si existen
              if (order.comments && Array.isArray(order.comments)) {
                newOrders[order.day].comments = order.comments;
              }
            }
          });
          
          // Guardar en localStorage para futura referencia
          try {
            localStorage.setItem(`orders_${getWeekStart()}_${currentUser}`, JSON.stringify(newOrders));
          } catch (e) {
            console.error("Error al guardar pedidos en localStorage:", e);
          }
          
          // Actualizar el estado con los pedidos cargados
          setOrders(newOrders);
        }
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Cargar pedidos iniciales
    loadOrders();

    // Suscripción para actualizaciones en tiempo real para el usuario actual
    const userChannel = supabase.channel('user_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_orders',
          filter: `week_start=eq.${getWeekStart()}&user_name=eq.${currentUser || ''}`
        },
        async (payload: any) => {
          console.log('Cambio en pedidos del usuario detectado:', payload.eventType, payload)
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new) {
              const { day, option, count, comments } = payload.new
              console.log(`Actualizando ${day}, opción: ${option}, cantidad: ${count}`);
              
              // Actualizar el estado local directamente con los nuevos datos
              setOrders(prev => ({
                ...prev,
                [day]: {
                  ...prev[day],
                  counts: {
                    ...prev[day].counts,
                    [option]: count
                  },
                  comments: comments || prev[day].comments
                }
              }))
            }
          } else if (payload.eventType === 'DELETE') {
            // Si se ha eliminado un pedido, recargar todos los pedidos para sincronizar
            console.log("Pedido eliminado, recargando todos los pedidos");
            await loadOrders();
          }
        }
      )
      .subscribe((status) => {
        console.log("Estado de suscripción de pedidos del usuario:", status);
      })

    // Suscripción para actualizaciones de TODOS los pedidos (para el resumen general)
    const globalChannel = supabase.channel('global_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_orders',
          filter: `week_start=eq.${getWeekStart()}`
        },
        async (payload: any) => {
          console.log('Cambio global en pedidos detectado:', payload.eventType, payload)
          
          // Actualizar automáticamente el resumen cuando hay cambios en los pedidos
          setSummaryNeedsUpdate(true);
          setLastGlobalUpdate(new Date());
          
          // Actualizar el resumen inmediatamente en vez de esperar
          await refreshSummary();
          
          // Si el cambio no es del usuario actual, mostrar una notificación
          if (payload.new && payload.new.user_name !== currentUser) {
            // Mostrar una notificación temporal
            const notification = document.createElement('div');
            notification.className = 'fixed bottom-4 right-4 bg-blue-100 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl z-50 animate-fadeIn';
            notification.innerHTML = `
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Un pedido ha sido actualizado por otro usuario</span>
              </div>
            `;
            document.body.appendChild(notification);
            
            // Eliminar la notificación después de 2 segundos
            setTimeout(() => {
              notification.classList.add('animate-fadeOut');
              setTimeout(() => notification.remove(), 500);
            }, 2000);
          }
        }
      )
      .subscribe((status) => {
        console.log("Estado de suscripción global de pedidos:", status);
      })
    
    // Suscripción para actualizaciones en el resumen general
    const summaryChannel = supabase.channel('summary_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_summaries',
          filter: `week_start=eq.${getWeekStart()}&user_name=eq.general`
        },
        async (payload: any) => {
          console.log('Cambio en el resumen general detectado:', payload.eventType, payload);
          
          // Actualizar el resumen si alguien lo actualizó
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new && payload.new.summary) {
              console.log('Actualizando resumen desde la base de datos');
              // Actualizamos el resumen con los datos recibidos
              setOrderSummary(payload.new.summary);
              setSummaryNeedsUpdate(false);
              lastSummaryUpdateRef.current = new Date();
              
              // Mostrar una notificación temporal
              const notification = document.createElement('div');
              notification.className = 'fixed bottom-4 right-4 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-xl z-50 animate-fadeIn';
              notification.innerHTML = `
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span>Resumen general actualizado por otro usuario</span>
                </div>
              `;
              document.body.appendChild(notification);
              
              // Eliminar la notificación después de 3 segundos
              setTimeout(() => {
                notification.classList.add('animate-fadeOut');
                setTimeout(() => notification.remove(), 500);
              }, 3000);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Estado de suscripción del resumen general:", status);
      });
    
    // Programar una actualización automática periódica del resumen (cada 1 minuto)
    const autoUpdateInterval = setInterval(() => {
      const now = new Date();
      const timeSinceLastUpdate = now.getTime() - lastSummaryUpdateRef.current.getTime();
      
      // Si ha pasado más de 1 minuto desde la última actualización y hay cambios pendientes
      if (timeSinceLastUpdate > 60000 && summaryNeedsUpdate) {
        console.log("Actualizando automáticamente el resumen general...");
        refreshSummary();
      }
    }, 60000);

    return () => {
      userChannel.unsubscribe();
      globalChannel.unsubscribe();
      summaryChannel.unsubscribe();
      clearInterval(autoUpdateInterval);
    }
  }, [currentUser, menuData])

  const handleIncrement = async (day: string, option: string) => {
    if (!currentUser) {
      alert('Por favor selecciona un usuario antes de hacer pedidos');
      return;
    }
    
    const buttonKey = `${day}-${option}-increment`
    setLoadingButtons(prev => ({ ...prev, [buttonKey]: true }))
    
    try {
      // Actualizar optimistamente el estado local primero para una UI más responsiva
      const newCount = orders[day].counts[option] + 1;
      const updatedOrders = {
        ...orders,
        [day]: {
          ...orders[day],
          counts: {
            ...orders[day].counts,
            [option]: newCount
          }
        }
      };
      
      setOrders(updatedOrders);
      
      // Guardar en localStorage para persistencia en caso de errores de red
      try {
        localStorage.setItem(`orders_${getWeekStart()}_${currentUser}`, JSON.stringify(updatedOrders));
        localStorage.setItem('hasOrderData', 'true');
      } catch (e) {
        console.error("Error al guardar en localStorage:", e);
      }

      // Verificar primero si el registro existe
      const { data: existingData, error: checkError } = await supabase
        .from('menu_orders')
        .select('count')
        .eq('week_start', getWeekStart())
        .eq('day', day)
        .eq('option', option)
        .eq('user_name', currentUser)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingData) {
        // Si existe, actualizar
        const { error: updateError } = await supabase
          .from('menu_orders')
          .update({
            count: newCount,
            comments: orders[day].comments || [],
            updated_at: new Date().toISOString()
          })
          .eq('week_start', getWeekStart())
          .eq('day', day)
          .eq('option', option)
          .eq('user_name', currentUser);

        if (updateError) throw updateError;
      } else {
        // Si no existe, insertar
        const { error: insertError } = await supabase
          .from('menu_orders')
          .insert({
            week_start: getWeekStart(),
            day,
            option,
            count: newCount,
            comments: orders[day].comments || [],
            updated_at: new Date().toISOString(),
            user_name: currentUser
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error completo:', error)
      
      // Revertir el cambio local si hay error
      setOrders(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          counts: {
            ...prev[day].counts,
            [option]: orders[day].counts[option]
          }
        }
      }))
      
      alert('Error al actualizar el contador. Por favor, intenta de nuevo.')
    } finally {
      setLoadingButtons(prev => ({ ...prev, [buttonKey]: false }))
    }
  }

  const handleDecrement = async (day: string, option: string) => {
    if (!currentUser) {
      alert('Por favor selecciona un usuario antes de hacer pedidos');
      return;
    }
    
    if (orders[day].counts[option] > 0) {
      const buttonKey = `${day}-${option}-decrement`
      setLoadingButtons(prev => ({ ...prev, [buttonKey]: true }))
      
      try {
        // Calcular el nuevo conteo (mínimo 0)
        const newCount = Math.max(0, orders[day].counts[option] - 1);
        
        // Actualizar optimistamente el estado local primero
        const updatedOrders = {
          ...orders,
          [day]: {
            ...orders[day],
            counts: {
              ...orders[day].counts,
              [option]: newCount
            }
          }
        };
        
        setOrders(updatedOrders);
        
        // Guardar en localStorage para persistencia en caso de errores de red
        try {
          localStorage.setItem(`orders_${getWeekStart()}_${currentUser}`, JSON.stringify(updatedOrders));
          localStorage.setItem('hasOrderData', 'true');
        } catch (e) {
          console.error("Error al guardar en localStorage:", e);
        }

        // Verificar primero si el registro existe
        const { data: existingData, error: checkError } = await supabase
          .from('menu_orders')
          .select('count')
          .eq('week_start', getWeekStart())
          .eq('day', day)
          .eq('option', option)
          .eq('user_name', currentUser)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingData) {
          // Si existe, actualizar
          const { error: updateError } = await supabase
            .from('menu_orders')
            .update({
              count: newCount,
              comments: orders[day].comments || [],
              updated_at: new Date().toISOString()
            })
            .eq('week_start', getWeekStart())
            .eq('day', day)
            .eq('option', option)
            .eq('user_name', currentUser);

          if (updateError) throw updateError;
        } else {
          // Si no existe, insertar (aunque esto no debería ocurrir en decrementos)
          const { error: insertError } = await supabase
            .from('menu_orders')
            .insert({
              week_start: getWeekStart(),
              day,
              option,
              count: newCount,
              comments: orders[day].comments || [],
              updated_at: new Date().toISOString(),
              user_name: currentUser
            });

          if (insertError) throw insertError;
        }
      } catch (error) {
        console.error('Error completo:', error)
        
        // Revertir el cambio local si hay error
        setOrders(prev => ({
          ...prev,
          [day]: {
            ...prev[day],
            counts: {
              ...prev[day].counts,
              [option]: orders[day].counts[option]
            }
          }
        }))
        
        alert('Error al actualizar el contador. Por favor, intenta de nuevo.')
      } finally {
        setLoadingButtons(prev => ({ ...prev, [buttonKey]: false }))
      }
    }
  }

  const handleAddComment = async (day: string) => {
    if (!currentUser || !newComment.trim()) return;
    
    // Asegurarnos de que el comentario no tenga ya el formato "texto (usuario)"
    const commentText = newComment.trim();
    const hasUserFormat = /^.+\s\([^)]+\)$/.test(commentText);
    
    // Si ya tiene el formato, extraer solo el texto del comentario
    const cleanComment = hasUserFormat 
      ? commentText.replace(/\s\([^)]+\)$/, '') 
      : commentText;
    
    const updatedComments = [...orders[day].comments, cleanComment]
    
    try {
      // Actualizar solo los registros del usuario actual para ese día
      const { error } = await supabase
        .from('menu_orders')
        .update({ comments: updatedComments })
        .eq('week_start', getWeekStart())
        .eq('day', day)
        .eq('user_name', currentUser)

      if (error) throw error

      setOrders(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          comments: updatedComments
        }
      }))
      setNewComment("")
      
      // Indicar que el resumen necesita actualizarse para incluir el nuevo comentario
      setSummaryNeedsUpdate(true)
      
      // Opcionalmente, actualizar el resumen inmediatamente
      refreshSummary()
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const handleRemoveComment = async (day: string, index: number) => {
    if (!currentUser) return;
    
    const updatedComments = orders[day].comments.filter((_, i) => i !== index)
    
    try {
      // Actualizar solo los registros del usuario actual para ese día
      const { error } = await supabase
        .from('menu_orders')
        .update({ comments: updatedComments })
        .eq('week_start', getWeekStart())
        .eq('day', day)
        .eq('user_name', currentUser)

      if (error) throw error

      setOrders(prev => ({
        ...prev,
        [day]: {
          ...prev[day],
          comments: updatedComments
        }
      }))
      
      // Indicar que el resumen necesita actualizarse para reflejar la eliminación del comentario
      setSummaryNeedsUpdate(true)
      
      // Opcionalmente, actualizar el resumen inmediatamente
      refreshSummary()
    } catch (error) {
      console.error('Error removing comment:', error)
    }
  }

  const toggleDay = (day: string) => {
    setOrders(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isExpanded: !prev[day].isExpanded
      }
    }))
    setActiveDay(prev => prev === day ? null : day)
  }

  // Función para refrescar el resumen sin necesidad de generar y guardar
  const refreshSummary = async () => {
    try {
      // Obtener TODOS los pedidos de la semana actual
      const { data: latestData, error: fetchError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('week_start', getWeekStart())

      if (fetchError) throw fetchError

      // Construimos el resumen con los datos más recientes
      const updatedOrders = { ...initializeOrders(menuData) }
      
      // Para mantener track de qué usuario hizo cada comentario
      const commentsByDay = {} as Record<string, Map<string, string>>;
      
      if (latestData) {
        // Inicializar mapas para comentarios por día
        orderedDays.forEach(day => {
          commentsByDay[day] = new Map();
        });
        
        // Sumar todos los pedidos de todas las personas
        latestData.forEach(order => {
          if (updatedOrders[order.day]) {
            // Si la opción no existe en updatedOrders, inicializarla
            if (!updatedOrders[order.day].counts[order.option]) {
              updatedOrders[order.day].counts[order.option] = 0;
            }
            // Sumar los pedidos de esta opción
            updatedOrders[order.day].counts[order.option] += order.count;
            
            // Guardar comentarios con referencia al usuario
            if (order.comments && Array.isArray(order.comments)) {
              order.comments.forEach((comment: string) => {
                const userName = order.user_name || 'Usuario';
                
                // Verificar si el comentario ya tiene formato "texto (usuario)"
                const hasUserFormat = /^.+\s\([^)]+\)$/.test(comment);
                
                if (hasUserFormat) {
                  // Si ya tiene el formato, usarlo directamente sin modificar
                  const commentKey = comment; // Usar el comentario completo como clave
                  commentsByDay[order.day].set(commentKey, comment);
                } else {
                  // Si no tiene el formato, añadir el nombre del usuario
                  const commentKey = `${comment}-${userName}`;
                  commentsByDay[order.day].set(commentKey, `${comment} (${userName})`);
                }
              });
            }
          }
        });
      }

      // Crear el resumen con comentarios que incluyen el nombre del usuario
      const summary = {
        orders: Object.entries(updatedOrders).map(([day, data]) => ({
          day,
          counts: data.counts,
          comments: Array.from(commentsByDay[day]?.values() || [])
        }))
      };

      // Actualizar el estado del resumen
      setOrderSummary(summary);
      setSummaryNeedsUpdate(false);
      lastSummaryUpdateRef.current = new Date();
      
      console.log("Resumen actualizado con éxito");
      
    } catch (error) {
      console.error('Error al actualizar el resumen:', error);
    }
  }

  const handleSubmit = async () => {
    if (!currentUser) {
      alert('Por favor selecciona un usuario antes de generar el resumen');
      return;
    }
    
    try {
      // Obtener TODOS los pedidos de la semana actual, sin filtrar por usuario para crear el resumen general
      const { data: latestData, error: fetchError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('week_start', getWeekStart())

      if (fetchError) throw fetchError

      // Construimos el resumen con los datos más recientes
      const updatedOrders = { ...initializeOrders(menuData) }
      
      // Para mantener track de qué usuario hizo cada comentario
      const commentsByDay = {} as Record<string, Map<string, string>>;
      
      if (latestData) {
        // Inicializar mapas para comentarios por día
        orderedDays.forEach(day => {
          commentsByDay[day] = new Map();
        });
        
        // Sumar todos los pedidos de todas las personas
        latestData.forEach(order => {
          if (updatedOrders[order.day]) {
            // Si la opción no existe en updatedOrders, inicializarla
            if (!updatedOrders[order.day].counts[order.option]) {
              updatedOrders[order.day].counts[order.option] = 0;
            }
            // Sumar los pedidos de esta opción
            updatedOrders[order.day].counts[order.option] += order.count;
            
            // Guardar comentarios con referencia al usuario
            if (order.comments && Array.isArray(order.comments)) {
              order.comments.forEach((comment: string) => {
                const userName = order.user_name || 'Usuario';
                
                // Verificar si el comentario ya tiene formato "texto (usuario)"
                const hasUserFormat = /^.+\s\([^)]+\)$/.test(comment);
                
                if (hasUserFormat) {
                  // Si ya tiene el formato, usarlo directamente sin modificar
                  const commentKey = comment; // Usar el comentario completo como clave
                  commentsByDay[order.day].set(commentKey, comment);
                } else {
                  // Si no tiene el formato, añadir el nombre del usuario
                  const commentKey = `${comment}-${userName}`;
                  commentsByDay[order.day].set(commentKey, `${comment} (${userName})`);
                }
              });
            }
          }
        });
      }

      // Crear el resumen general con comentarios que incluyen el nombre del usuario
      const summary = {
        orders: Object.entries(updatedOrders).map(([day, data]) => ({
          day,
          counts: data.counts,
          comments: Array.from(commentsByDay[day]?.values() || [])
        }))
      };

      // Guardar el resumen general en Supabase
      const { error } = await supabase
        .from('order_summaries')
        .upsert({
          week_start: getWeekStart(),
          user_name: 'general', // Usamos 'general' como identificador para el resumen global
          summary: summary,
          updated_by: currentUser,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'week_start,user_name',
          ignoreDuplicates: false
        })

      if (error) throw error
      
      setOrderSummary(summary)
      setSummaryNeedsUpdate(false)
      lastSummaryUpdateRef.current = new Date();
      
      alert('Resumen general generado exitosamente')

    } catch (error) {
      console.error('Error al guardar el resumen:', error)
      alert('Error al guardar el resumen. Por favor, intenta de nuevo.')
    }
  }

  // Cargar el último resumen general al iniciar
  useEffect(() => {
    const loadLastSummary = async () => {
      try {
        // Primero intentamos cargar el último resumen guardado
        const { data, error } = await supabase
          .from('order_summaries')
          .select('summary')
          .eq('week_start', getWeekStart())
          .eq('user_name', 'general') // Cargamos específicamente el resumen general
          .single()

        if (error) {
          if (error.code !== 'PGRST116') { // No data found
            console.error('Error al cargar el último resumen guardado:', error)
          }
          
          // Si no hay resumen guardado o hubo un error, generamos uno fresco
          console.log('No se encontró un resumen guardado, generando uno nuevo...');
          await refreshSummary();
          return;
        }

        if (data?.summary) {
          console.log('Resumen general cargado de la base de datos');
          setOrderSummary(data.summary);
          lastSummaryUpdateRef.current = new Date();
        } else {
          // Si no hay datos de resumen, generamos uno fresco
          console.log('Resumen vacío, generando uno nuevo...');
          await refreshSummary();
        }
      } catch (error) {
        console.error('Error al cargar el último resumen:', error);
        // En caso de error, intentamos generar un resumen fresco
        await refreshSummary();
      }
    }

    loadLastSummary();
  }, []);

  const clearAllComments = async () => {
    if (!currentUser) {
      alert('Por favor selecciona un usuario antes de realizar esta acción');
      return;
    }
    
    // Confirmar la acción con el usuario para evitar borrados accidentales
    const confirmDelete = confirm("¿Estás seguro de que deseas eliminar TODOS los comentarios de TODOS los usuarios? Esta acción no puede deshacerse.");
    if (!confirmDelete) return;
    
    try {
      console.log("Iniciando limpieza de todos los comentarios...");
      
      // Ejecutar una única operación para actualizar todos los registros de la semana actual
      const { error: updateError, count } = await supabase
        .from('menu_orders')
        .update({ comments: [] })
        .eq('week_start', getWeekStart());
      
      if (updateError) throw updateError;
      
      console.log(`Se han limpiado los comentarios de ${count || 'todos los'} registros`);
      
      // Actualizar la UI localmente para todos los días
      const updatedOrders = { ...orders };
      orderedDays.forEach(day => {
        updatedOrders[day] = {
          ...updatedOrders[day],
          comments: [] // Limpiar comentarios localmente
        };
      });
      
      setOrders(updatedOrders);
      
      // Actualizar el resumen general
      await refreshSummary();
      
      alert('Todos los comentarios han sido eliminados correctamente');
      
    } catch (error) {
      console.error('Error al eliminar comentarios:', error);
      alert('Ocurrió un error al eliminar los comentarios. Por favor, intenta de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <span className="text-gray-600">Cargando pedidos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-refresh-summary="true">
      {/* Alerta de nuevo menú */}
      {menuResetNotification && (
        <div className="flex items-center gap-4 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium">El menú ha sido actualizado.</p>
            <p className="text-sm mt-1">Los pedidos anteriores han sido reiniciados.</p>
          </div>
        </div>
      )}

      {/* Botón para recargar los pedidos individuales */}
      <div className="flex justify-end mb-4">
        <button
          onClick={async () => {
            if (!currentUser) {
              alert('Por favor selecciona un usuario antes de realizar esta acción');
              return;
            }
            
            setLoading(true);
            
            try {
              console.log("Recargando pedidos para:", currentUser, "semana:", getWeekStart());
              
              // Limpiar localStorage para forzar recarga total
              localStorage.removeItem(`orders_${getWeekStart()}_${currentUser}`);
              
              // Cargar directamente de Supabase
              const { data, error } = await supabase
                .from('menu_orders')
                .select('*')
                .eq('week_start', getWeekStart())
                .eq('user_name', currentUser);
              
              if (error) throw error;
              
              // Inicializar con el menú actual (todos en 0)
              const newOrders = initializeOrders(menuData);
              
              if (data && data.length > 0) {
                console.log("Pedidos recargados correctamente:", data.length);
                
                // Actualizar los valores con los datos cargados
                data.forEach(order => {
                  if (newOrders[order.day] && menuData[order.day]?.includes(order.option)) {
                    newOrders[order.day].counts[order.option] = order.count;
                    
                    // Asignar los comentarios si existen
                    if (order.comments && Array.isArray(order.comments)) {
                      newOrders[order.day].comments = order.comments;
                    }
                  }
                });
                
                // Guardar en localStorage para futura referencia
                try {
                  localStorage.setItem(`orders_${getWeekStart()}_${currentUser}`, JSON.stringify(newOrders));
                  localStorage.setItem('hasOrderData', 'true');
                } catch (e) {
                  console.error("Error al guardar pedidos en localStorage:", e);
                }
              } else {
                console.log("No se encontraron pedidos para el usuario");
              }
              
              // Actualizar el estado con los pedidos cargados (o con todos en 0 si no hay datos)
              setOrders(newOrders);
              
              alert("¡Pedidos actualizados correctamente!");
              
            } catch (error) {
              console.error("Error al recargar pedidos:", error);
              alert("Error al recargar tus pedidos. Por favor, intenta de nuevo.");
            } finally {
              setLoading(false);
            }
          }}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Recargar mis pedidos</span>
        </button>
      </div>

      {/* Mensaje informativo sobre horario límite */}
      <div className="flex items-center gap-4 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-medium">¡Atención! Horario límite para pedidos</p>
          <p className="text-sm mt-1">Solo se pueden cargar pedidos hasta las 15:00 hs del viernes.</p>
        </div>
      </div>

      {summaryNeedsUpdate && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Hay nuevos pedidos de otros usuarios. El resumen general necesita actualizarse.</span>
          </div>
          <button 
            onClick={refreshSummary}
            className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-sm"
          >
            Actualizar ahora
          </button>
        </div>
      )}
      
      {orderedDays.map((day) => (
        <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => toggleDay(day)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-medium text-gray-900">{day}</span>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(orders[day].counts).reduce((sum, [_, count]) => sum + count, 0) > 0 && (
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  {Object.entries(orders[day].counts).reduce((sum, [_, count]) => sum + count, 0)} pedidos
                </span>
              )}
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${orders[day].isExpanded ? 'transform rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {orders[day].isExpanded && (
            <div className="p-4 border-t border-gray-100 space-y-4">
              <div className="grid gap-4">
                {menuData[day]?.map((option) => (
                  <div key={option} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">{option}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDecrement(day, option)}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        disabled={orders[day].counts[option] === 0 || loadingButtons[`${day}-${option}-decrement`]}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="w-8 text-center font-medium">
                        {loadingButtons[`${day}-${option}-increment`] || loadingButtons[`${day}-${option}-decrement`] ? (
                          <svg className="animate-spin h-5 w-5 mx-auto text-blue-600" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                        ) : (
                          orders[day].counts[option]
                        )}
                      </span>
                      <button
                        onClick={() => handleIncrement(day, option)}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        disabled={loadingButtons[`${day}-${option}-increment`]}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Agregar comentario o nota especial..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handleAddComment(day)}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>

                {orders[day].comments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-700">Comentarios:</h4>
                    <div className="space-y-2">
                      {orders[day].comments.map((comment, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">{comment}</span>
                          <button
                            onClick={() => handleRemoveComment(day, index)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="mt-8 flex flex-wrap gap-4 justify-end">
        <button
          onClick={refreshSummary}
          data-refresh-button
          className="px-5 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 flex items-center gap-2 shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Actualizar Resumen</span>
        </button>
        <button
          onClick={handleSubmit}
          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>Generar Resumen</span>
        </button>
      </div>
    </div>
  )
}

