"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function MenuDataLoader({ setMenuData }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        // Cargar siempre el menú más reciente sin filtrar por week_start
        const { data, error } = await supabase
          .from("weekly_menus")
          .select("menu_data, id, week_start, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)

        if (error) {
          throw error
        }

        if (data && data.length > 0) {
          console.log("Menú más reciente cargado:", data[0])
          
          // Guardar los datos del menú en localStorage para persistencia entre sesiones
          try {
            localStorage.setItem('currentMenu', JSON.stringify(data[0]))
            localStorage.setItem('menuLastLoaded', new Date().toISOString())
          } catch (e) {
            console.error("Error al guardar menú en localStorage:", e)
          }
          
          setMenuData(data[0].menu_data)
        } else {
          console.log("No menu data found")
          
          // Intentar cargar desde localStorage si está disponible
          try {
            const cachedMenu = localStorage.getItem('currentMenu')
            if (cachedMenu) {
              const parsedMenu = JSON.parse(cachedMenu)
              console.log("Usando menú almacenado en caché:", parsedMenu)
              setMenuData(parsedMenu.menu_data)
            }
          } catch (e) {
            console.error("Error al cargar menú desde localStorage:", e)
          }
        }
      } catch (error) {
        console.error("Error loading menu data:", error)
        setError(error.message)
        
        // Intentar cargar desde localStorage si hay un error
        try {
          const cachedMenu = localStorage.getItem('currentMenu')
          if (cachedMenu) {
            const parsedMenu = JSON.parse(cachedMenu)
            console.log("Usando menú almacenado en caché debido a error:", parsedMenu)
            setMenuData(parsedMenu.menu_data)
          }
        } catch (e) {
          console.error("Error al cargar menú desde localStorage:", e)
        }
      } finally {
        setLoading(false)
      }
    }

    loadMenuData()
  }, [setMenuData])

  if (loading) {
    return <p>Cargando datos del menú...</p>
  }

  if (error) {
    return <p>Error al cargar los datos del menú: {error}</p>
  }

  return null
}

