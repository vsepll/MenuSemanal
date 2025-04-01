"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

// Definimos el tipo para el objeto de menú
interface MenuDataType {
  [key: string]: string[]
}

// Definimos el tipo para las props del componente
interface MenuDataLoaderProps {
  setMenuData: (data: MenuDataType) => void;
}

export default function MenuDataLoader({ setMenuData }: MenuDataLoaderProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setError(error instanceof Error ? error.message : "Error desconocido");
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

