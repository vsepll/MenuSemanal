import { createClient } from "@supabase/supabase-js"

// Asegurar que las URL no sean undefined para resolver el error de tipos
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Mejorar opciones del cliente para persistencia de datos
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (...args) => fetch(...args)
  },
})

