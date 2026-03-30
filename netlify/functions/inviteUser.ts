import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { optionsResponse, getUserAndProfile, isPrivilegedRole } from './_util';

// Configuración de cliente Supabase con Service Role para bypass de RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, serviceKey!);

export const handler: Handler = async (event) => {
  // 1. Manejo de CORS pre-flight
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  try {
    // 2. SEGURIDAD: Validamos que el administrador tenga sesión activa y rol privilegiado
    const { user: adminUser, profile: adminProfile } = await getUserAndProfile(event);
    
    if (!adminUser || !adminProfile || !isPrivilegedRole(adminProfile.role)) {
      return { 
        statusCode: 403, 
        headers,
        body: JSON.stringify({ message: "No autorizado. Se requiere rol administrativo." }) 
      };
    }

    const { email, full_name, role, client_id } = JSON.parse(event.body || '{}');

    if (!email || !full_name) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ message: "Email y Nombre completo son requeridos" }) 
      };
    }

    /**
     * 3. CONFIGURACIÓN DINÁMICA DE REDIRECCIÓN
     * NETLIFY_DEV es true cuando ejecutas 'netlify dev'.
     * Esto asegura que el link del correo funcione según el entorno.
     */
    const isLocal = process.env.NETLIFY_DEV === 'true';
    const prodUrl = "https://fresh-food-tracker.netlify.app";
    const localUrl = "http://localhost:8888";
    
    const baseUrl = isLocal ? localUrl : prodUrl;
    const redirectTo = `${baseUrl}/reset-password`;

    console.log(`[INVITE] Entorno: ${isLocal ? 'LOCAL' : 'PROD'} | Invitando: ${email} | Link: ${redirectTo}`);

    // 4. Invitación oficial vía Admin Auth (Service Role)
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: { 
          full_name: full_name,
          role: role || 'client'
        },
        redirectTo: redirectTo
      }
    );

    if (inviteError) {
        console.error("Error de Supabase Auth:", inviteError.message);
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ message: inviteError.message }) 
        };
    }

    const newUserId = inviteData.user.id;

    // 5. Vinculación con la tabla 'clients'
    if (role === 'client' && client_id) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          has_platform_access: true,
          auth_user_id: newUserId,
          status: 'active'
        })
        .eq('id', client_id);

      if (updateError) console.error("Error vinculando tabla clients:", updateError.message);
    }

    /**
     * 6. CREACIÓN DE PERFIL (Profiles)
     * Aunque tenemos el Trigger SQL, este upsert actúa como respaldo 
     * para asegurar que el rol se asigne correctamente desde el origen.
     */
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: newUserId,
        full_name,
        role: role || 'client',
        email: email.toLowerCase().trim()
      }, { onConflict: 'user_id' });
        
    if (profileError) console.error("Error actualizando perfil:", profileError.message);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: `Usuario autorizado e invitación enviada a ${email}`,
        user_id: newUserId 
      }),
    };

  } catch (error: any) {
    console.error("Error crítico en inviteUser function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Error interno del servidor", details: error.message }),
    };
  }
};