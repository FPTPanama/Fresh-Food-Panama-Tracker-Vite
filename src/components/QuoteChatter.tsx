import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { 
  Send, 
  MessageSquare, 
  History, 
  User, 
  ShieldCheck, 
  Clock,
  AlertCircle
} from "lucide-react";

interface Profile {
  full_name: string;
}

interface Activity {
  id: string;
  message: string;
  sender_role: 'admin' | 'client';
  created_at: string;
  is_internal: boolean;
  profiles: Profile;
}

interface QuoteChatterProps {
  quoteId: string;
  currentUserRole: 'admin' | 'client';
  currentUserId: string;
}

export function QuoteChatter({ quoteId, currentUserRole, currentUserId }: QuoteChatterProps) {
  const [messages, setMessages] = useState<Activity[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'message' | 'log'>('message');

  useEffect(() => {
    if (!quoteId) return;
    
    loadActivity();

    // Suscripción Realtime para actualización instantánea
    const channel = supabase
      .channel(`quote_chatter_${quoteId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'quote_activity', 
          filter: `quote_id=eq.${quoteId}` 
        }, 
        () => loadActivity()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quoteId]);

  async function loadActivity() {
    const { data, error } = await supabase
      .from('quote_activity')
      .select('*, profiles(full_name)')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false }); // Lo más nuevo arriba para el feed

    if (error) {
      console.error("Error cargando chatter:", error);
      return;
    }
    if (data) setMessages(data as any);
  }

  async function handleSend() {
    if (!newMessage.trim() || loading) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('quote_activity').insert({
        quote_id: quoteId,
        sender_id: currentUserId,
        sender_role: currentUserRole,
        message: newMessage.trim(),
        is_internal: false
      });

      if (error) throw error;

      setNewMessage("");
      loadActivity();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ff-chatter-container">
      {/* TABS ESTILO ODOO */}
      <div className="chatter-navigation">
        <button 
          className={activeTab === 'message' ? 'active' : ''} 
          onClick={() => setActiveTab('message')}
        >
          <MessageSquare size={16} /> Enviar Mensaje
        </button>
        <button 
          className={activeTab === 'log' ? 'active' : ''} 
          onClick={() => setActiveTab('log')}
        >
          <History size={16} /> Log de Actividad
        </button>
      </div>

      {/* COMPOSER / CAJA DE TEXTO */}
      <div className="chatter-composer-card">
        <textarea 
          placeholder="Escriba aquí para dejar un registro o solicitar un cambio..." 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={loading}
        />
        <div className="composer-footer">
          <p className="composer-hint">Presione Enviar para notificar al equipo.</p>
          <button 
            className="btn-send-chatter" 
            onClick={handleSend} 
            disabled={loading || !newMessage.trim()}
          >
            {loading ? 'Enviando...' : 'Enviar Mensaje'} 
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* FEED DE ACTIVIDAD */}
      <div className="chatter-feed-list">
        {messages.length === 0 ? (
          <div className="empty-chatter">
            <Clock size={24} />
            <p>No hay mensajes ni actividad registrada aún.</p>
          </div>
        ) : (
          messages.map((item) => (
            <div key={item.id} className={`feed-entry ${item.sender_role}`}>
              <div className="feed-avatar-wrapper">
                <div className={`avatar-circle ${item.sender_role}`}>
                  {item.sender_role === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
                </div>
              </div>
              <div className="feed-content-wrapper">
                <div className="feed-info">
                  <span className="user-name">
                    {item.profiles?.full_name || (item.sender_role === 'admin' ? 'Fresh Food Admin' : 'Cliente')}
                  </span>
                  <span className="timestamp">
                    {new Date(item.created_at).toLocaleString('es-PA', { 
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="message-text">
                  {item.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .ff-chatter-container {
          max-width: 1000px;
          margin: 40px auto;
          font-family: 'Inter', sans-serif;
        }

        .chatter-navigation {
          display: flex;
          gap: 30px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 25px;
        }

        .chatter-navigation button {
          background: none;
          border: none;
          padding: 10px 5px;
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.2s;
          position: relative;
        }

        .chatter-navigation button.active {
          color: #166534;
        }

        .chatter-navigation button.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 2px;
          background: #166534;
        }

        .chatter-composer-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          margin-bottom: 40px;
        }

        .chatter-composer-card textarea {
          width: 100%;
          border: none;
          padding: 20px;
          font-size: 14px;
          min-height: 100px;
          outline: none;
          resize: vertical;
          color: #1e293b;
        }

        .composer-footer {
          background: #f8fafc;
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #f1f5f9;
        }

        .composer-hint {
          font-size: 11px;
          color: #94a3b8;
          margin: 0;
        }

        .btn-send-chatter {
          background: #166534;
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: 0.2s;
        }

        .btn-send-chatter:hover:not(:disabled) {
          background: #14532d;
          transform: translateY(-1px);
        }

        .btn-send-chatter:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chatter-feed-list {
          display: flex;
          flex-direction: column;
          gap: 30px;
          padding-left: 10px;
        }

        .feed-entry {
          display: flex;
          gap: 15px;
          position: relative;
        }

        /* Línea vertical de tiempo */
        .feed-entry:not(:last-child)::before {
          content: '';
          position: absolute;
          top: 40px;
          left: 17px;
          width: 1px;
          height: calc(100% + 15px);
          background: #e2e8f0;
        }

        .avatar-circle {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          z-index: 2;
          position: relative;
        }

        .avatar-circle.admin { background: #1e293b; }
        .avatar-circle.client { background: #166534; }

        .feed-content-wrapper {
          flex: 1;
        }

        .feed-info {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 5px;
        }

        .user-name {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }

        .timestamp {
          font-size: 11px;
          color: #94a3b8;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 0 12px 12px 12px;
          display: inline-block;
          max-width: 80%;
          border: 1px solid #f1f5f9;
        }

        .feed-entry.admin .message-text {
            background: #fff;
            border-color: #e2e8f0;
        }

        .empty-chatter {
          text-align: center;
          padding: 40px;
          color: #94a3b8;
        }

        .empty-chatter p {
          margin-top: 10px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}