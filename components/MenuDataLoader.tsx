"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function MenuDataLoader({ setMenuData }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadMenuData = async () => {
      try {
        const { data, error } = await supabase
          .from("weekly_menus")
          .select("menu_data")
          .order("week_start", { ascending: false })
          .limit(1)

        if (error) {
          throw error
        }

        if (data && data.length > 0) {
          setMenuData(data[0].menu_data)
        } else {
          console.log("No menu data found")
        }
      } catch (error) {
        console.error("Error loading menu data:", error)
        setError(error.message)
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

