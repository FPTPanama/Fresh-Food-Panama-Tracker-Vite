import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler = async () => {
  console.log("🧪 LANZANDO PRUEBA GLOBAL B2B (FreshConnect + Europa)...");

  try {
    const mockLead = {
      company_name: "FRUTAS Y VERDURAS J&R BARGUEÑO, S.L.",
      contact_email: "freddyjgv@gmail.com"
    };

    const cleanName = mockLead.company_name.replace(/,?\s*(S\.L\.|S\.A\.|S\.A\.U\.|S\.L\.U\.|S\.L\. UNIPERSONAL|S\.L\.U)$/i, '');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5; max-width: 600px;">
        <p>Hola, equipo de ${cleanName},</p>
        
        <p>Espero que se encuentren muy bien.</p>
        
        <p>Les contacto desde Fresh Food Panamá. Somos productores y exportadores de piña MD2 Golden con capacidad de entrega en 48 horas en los principales aeropuertos de Europa.</p>
        
        <p>Nuestra fruta cuenta con certificaciones Global G.A.P. y FDA, garantizando calibres 5-6, color 2.5-3 y brix >13. Para asegurar la máxima transparencia, integramos el sistema FreshConnect en todas nuestras operaciones, permitiéndoles acceso en tiempo real a los documentos de carga, inspección visual en origen y seguimiento de tránsito.</p>
        
        <p>Al tener ya presencia en España, buscamos establecer alianzas sólidas con importadores que valoren la trazabilidad y la calidad premium. ¿Podríamos agendar una breve reunión para presentarles nuestra oferta y el funcionamiento de nuestra plataforma?</p>
        
        <p>Saludos cordiales,</p>
        
        <p>
          Freddy García<br>
          Fresh Food Panamá C.A.<br>
          Calle 55E Obarrio, Torre SFC, Oficina 26D. Ciudad de Panamá.<br>
          www.freshfoodpanama.com
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 25px;">
        <p style="font-size: 11px; color: #999;">
          Enviado a ${mockLead.contact_email}. Si prefiere no recibir más información, por favor responda a este correo.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: 'Freddy García - Fresh Food Panama <ventas@freshfoodpanama.com>',
      to: mockLead.contact_email,
      subject: `Suministro piña MD2 Global - ${cleanName}`,
      html: htmlBody,
      replyTo: 'ventas@freshfoodpanama.com',
      tags: [{ name: 'campaign', value: 'global_launch_test' }]
    });

    console.log(`✅ Test Global enviado exitosamente a ${mockLead.contact_email}`);
    return { statusCode: 200 };

  } catch (err: any) {
    console.error("❌ Error en el test:", err.message);
    return { statusCode: 500 };
  }
};