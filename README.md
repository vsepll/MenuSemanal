FormManager
![Next.js](https://img.shields.io/badge/nextjs-14.2.14-black)
![MongoDB](https://img.shields.io/badge/mongodb-6.9.0-green)
![React](https://img.shields.io/badge/react-18-blue)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3.4.1-teal)
![TypeScript](https://img.shields.io/badge/typescript-5-blue)

📋 Descripción

FormManager es una aplicación web robusta para la gestión de formularios (planillas) relacionados con eventos y espectáculos.
Permite crear, editar, compartir y administrar formularios detallados que incluyen información como datos del evento, sectores, precios, descuentos, métodos de venta y más.

✨ Características
Panel de control administrativo para gestión centralizada
Creación de planillas con formularios detallados y completos
Sistema de autenticación basado en roles (admin/user)
Exportación de planillas en formatos PDF y Excel
Compartición mediante enlaces únicos
Archivado y restauración de planillas
Personalización de campos según el tipo de evento
Gestión de sectores y mapas interactivos

🛠️ Tecnologías
Frontend: React, Next.js, TypeScript
UI/UX: Tailwind CSS, componentes personalizados
Backend: Next.js API Routes
Base de datos: MongoDB
Autenticación: NextAuth.js
Exportación: PDFKit
Formularios: React Hook Form

🔧 Requisitos previos
Node.js 18.x o superior
MongoDB
NPM o Yarn

🚀 Instalación
# Clonar el repositorio
git clone https://github.com/username/FormManager.git
cd FormManager

# Instalar dependencias
npm install

# Configurar variables de entorno (copia el ejemplo)
cp .env.example .env.local

# Iniciar en modo desarrollo
npm run dev

⚙️ Configuración
Crea un archivo .env.local con las siguientes variables:

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
ADMIN_PASSWORD=your-admin-password
USER_PASSWORD=your-user-password
MONGODB_URI="mongodb+srv://user:password@your-cluster.mongodb.net/forms?retryWrites=true&w=majority"
JWT_SECRET=your-jwt-secret

📱 Uso
Accede al panel de control: Inicia sesión con las credenciales de administrador
Crea una nueva planilla: Utiliza el botón "Crear planilla" en el panel
Completa los datos del evento: Nombre, ubicación, fecha, sectores, precios, etc.
Comparte la planilla: Genera un enlace único para compartir con clientes
Exporta los datos: Descarga la información en formatos PDF o Excel
📁 Estructura del proyecto

FormManager/
├── components/     # Componentes React reutilizables
├── lib/            # Utilidades y funciones auxiliares
├── models/         # Esquemas y modelos de datos (MongoDB)
├── pages/          # Páginas y rutas de Next.js
│   ├── api/        # Endpoints de la API
│   └── ...
├── public/         # Archivos estáticos
├── styles/         # Estilos CSS/Tailwind
└── ...

🧑‍💻 Desarrollo
Para iniciar el entorno de desarrollo:

npm run dev

Para construir para producción:

npm run build
npm start

🚢 Despliegue
La aplicación está configurada para desplegar fácilmente en:
Vercel: Compatible con la integración continua
Servidor propio: Utiliza PM2 para gestionar el proceso:

npm run build
pm2 start npm --name "form-manager" -- start
