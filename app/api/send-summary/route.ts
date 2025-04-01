import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';
import { supabase } from '@/lib/supabase';

// Interfaces para tipar correctamente
interface OrderItem {
  id: string;
  day: string;
  option: string;
  count: number;
  user_name: string;
  comments: string[];
  week_start: string;
  created_at: string;
}

interface OrderSummary {
  orders: Array<{
    day: string;
    counts: Record<string, number>;
    comments: string[];
  }>;
}

// Definición del orden de los días
const orderedDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Función para obtener el inicio de la semana actual (lunes)
const getWeekStart = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo, retrocedemos 6 días, sino calculamos la diferencia hasta el lunes
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  return monday.toISOString().split('T')[0];
};

// Verificar si es viernes a las 16:00 (o aproximadamente esa hora)
const isTimeToSendSummary = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo, 1 = lunes, ..., 5 = viernes
  const hour = now.getHours();
  
  // Es viernes (día 5) y son las 16:00 (o dentro de un rango de 15:45 a 16:15)
  return day === 5 && hour >= 15 && hour < 17;
};

export async function GET(req: NextRequest) {
  try {
    // Verificación opcional: solo enviar a las 16:00 los viernes
    // Puedes comentar esta verificación si vas a usar un scheduler externo
    if (!isTimeToSendSummary() && !req.nextUrl.searchParams.has('force')) {
      return NextResponse.json({
        success: false,
        message: 'Esta API solo se ejecuta los viernes a las 16:00 horas o con parámetro force=true'
      }, { status: 400 });
    }

    // Obtener los pedidos de la semana actual
    const { data: orders, error } = await supabase
      .from('menu_orders')
      .select('*')
      .eq('week_start', getWeekStart());

    if (error) {
      throw error;
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No hay pedidos para esta semana'
      }, { status: 404 });
    }

    // Procesar los pedidos para generar el resumen
    const ordersByDay = (orders as OrderItem[]).reduce((acc, order) => {
      const day = order.day;
      if (!acc[day]) {
        acc[day] = {
          counts: {},
          comments: []
        };
      }

      // Incrementar contador para esta opción
      if (!acc[day].counts[order.option]) {
        acc[day].counts[order.option] = 0;
      }
      acc[day].counts[order.option] += order.count;

      // Agregar comentarios únicos (con referencia al usuario)
      if (order.comments && order.comments.length > 0) {
        order.comments.forEach((comment: string) => {
          const formattedComment = comment.includes('(') 
            ? comment 
            : `${comment} (${order.user_name})`;
          
          if (!acc[day].comments.includes(formattedComment)) {
            acc[day].comments.push(formattedComment);
          }
        });
      }

      return acc;
    }, {} as Record<string, { counts: Record<string, number>; comments: string[] }>);

    // Convertir a formato de resumen
    const summary: OrderSummary = {
      orders: Object.entries(ordersByDay).map(([day, data]) => ({
        day,
        counts: data.counts,
        comments: data.comments
      }))
    };

    // Obtener las opciones únicas para cada día
    const dayOptions = Object.entries(ordersByDay)
      .filter(([_, data]) => Object.keys(data.counts).length > 0) // Filtrar días sin pedidos
      .map(([day, data]) => ({ day, options: Object.keys(data.counts) }))

    // Ordenar los días según el orden definido
    dayOptions.sort((a, b) => orderedDays.indexOf(a.day) - orderedDays.indexOf(b.day))

    // Generar el HTML del resumen
    let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb; text-align: center; margin-bottom: 20px;">Resumen de Pedidos - Semana del ${getWeekStart()}</h1>
      <p style="text-align: center; color: #666; margin-bottom: 30px;">A continuación se presenta el resumen de los pedidos para esta semana.</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Día</th>
          <th>Opciones</th>
        </tr>
      </thead>
      <tbody>
        ${dayOptions.map(({ day, options }) => `
          <tr>
            <td>${day}</td>
            <td>${options.join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <h3>Comentarios:</h3>
    <ul>
      ${Object.entries(ordersByDay)
        .flatMap(([_, dayData]) => dayData.comments)
        .filter(comment => comment && comment.trim() !== '')
        .map(comment => `<li>${comment}</li>`)
        .join('')}
    </ul>
    <p style="text-align: center; color: #9ca3af; font-size: 14px; margin-top: 30px;">
      Este correo fue enviado automáticamente por el Sistema de Pedidos de Comida.
    </p>
    </div>
    `

    // Configurar transporte de correo (ejemplo con Gmail, ajustar según proveedor)
    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Configurar destinatarios
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_RECIPIENTS,
      subject: `Resumen de Pedidos - Semana del ${getWeekStart()}`,
      html: htmlContent,
    };

    // Enviar correo
    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: 'Resumen enviado por correo exitosamente',
      summary
    });
  } catch (error) {
    console.error('Error al enviar el resumen por correo:', error);
    return NextResponse.json({
      success: false,
      message: 'Error al enviar el resumen por correo',
      error: String(error)
    }, { status: 500 });
  }
} 