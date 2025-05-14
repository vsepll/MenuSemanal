"use client"

import { useState, useEffect, useRef } from 'react'

interface UserSelectorProps {
  onSelectUser: (userName: string) => void
}

export default function UserSelector({ onSelectUser }: UserSelectorProps) {
  const [userName, setUserName] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [showSelector, setShowSelector] = useState<boolean>(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Ejemplo de lista de empleados
  const employeeList = [
    "oriana",
    "valentin",
    "miguel",
    "micaela",
    "mariana",
    "maru",
    "paula",
    "martin",
    "gustavo",
    "francisco",
    "polilla",
    "carla",
    "carled",
    "facu",
    "jose",
    "fede",
    "tomi"
  ]

  useEffect(() => {
    // Verificar si ya hay un usuario guardado en localStorage
    const savedUser = localStorage.getItem('comidaUser')
    if (savedUser) {
      setSelectedUser(savedUser)
      setShowSelector(false)
      onSelectUser(savedUser)
    }
  }, [onSelectUser])

  // Cerrar el dropdown cuando se hace clic fuera de él
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelectUser = () => {
    if (userName.trim()) {
      localStorage.setItem('comidaUser', userName)
      setSelectedUser(userName)
      setShowSelector(false)
      onSelectUser(userName)
    }
  }

  const handleChangeUser = () => {
    setShowSelector(true)
    setSelectedUser(null)
    localStorage.removeItem('comidaUser')
  }

  const handleSelectFromDropdown = (employee: string) => {
    setUserName(employee)
    setIsDropdownOpen(false)
  }

  if (!showSelector && selectedUser) {
    return (
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Usuario actual</p>
            <p className="font-medium text-gray-900">{selectedUser}</p>
          </div>
        </div>
        <button 
          onClick={handleChangeUser}
          className="px-3 py-1.5 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <h3 className="text-lg font-medium text-gray-900 mb-4">¿Quién eres?</h3>
      <p className="text-gray-600 mb-6">Selecciona tu nombre para asociar tus pedidos</p>
      
      <div className="space-y-4">
        <div className="relative" ref={dropdownRef}>
          <div 
            className="flex justify-between items-center w-full px-4 py-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-200 hover:bg-blue-50"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className={userName ? "text-gray-900" : "text-gray-400"}>
              {userName || "Selecciona tu nombre"}
            </span>
            <svg 
              className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? "transform rotate-180" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {employeeList.map((employee) => (
                <div
                  key={employee}
                  onClick={() => handleSelectFromDropdown(employee)}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                    userName === employee ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {employee}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="relative mt-4">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="O escribe tu nombre completo"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          onClick={handleSelectUser}
          disabled={!userName.trim()}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar
        </button>
      </div>
    </div>
  )
} 