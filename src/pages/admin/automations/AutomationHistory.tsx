/* REEMPLAZA TODO TU AutomationHistory.tsx CON ESTE CÓDIGO CORREGIDO */
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Search, Filter, MessageSquare, Mail, CheckCircle, XCircle, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AutomationHistory = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const uniqueTriggers = useMemo(() => ['all', ...new Set(logs.map(l => l.rule_title))], [logs]);
  const uniqueTypes = useMemo(() => ['all', ...new Set(logs.map(l => l.record_type))], [logs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (log.reference_number && log.reference_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || log.record_type === typeFilter;
    const matchesTrigger = triggerFilter === 'all' || log.rule_title === triggerFilter;
    return matchesSearch && matchesType && matchesTrigger;
  });

  return (
    <div className="ah-container">
      <div className="ah-filter-grid">
        <div className="ah-search-box">
          <label><Search size={12} /> BUSCAR MIEMBRO O ID</label>
          <input 
            type="text" 
            placeholder="Ej: Pedro Rojas o #1024..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="ah-filter-box">
          <label><Tag size={12} /> CATEGORÍA</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Todas las categorías</option>
            {uniqueTypes.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="ah-filter-box">
          <label><Filter size={12} /> EVENTO DISPARADO</label>
          <select value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value)}>
            <option value="all">Todos los eventos</option>
            {uniqueTriggers.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <button onClick={fetchLogs} className="ah-refresh-btn"><Clock size={18} /></button>
      </div>

      <div className="ah-table-card">
        {loading && <div className="ah-loader"><div className="spinner"></div></div>}
        
        <div className="ah-scroll-area">
          {filteredLogs.length === 0 && !loading ? (
            <div className="ah-empty">No se encontraron registros de auditoría.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="ah-row">
                <div className="ah-info">
                  <div className={`ah-icon-circle ${log.channel === 'WhatsApp' ? 'wa' : 'em'}`}>
                    {log.channel === 'WhatsApp' ? <MessageSquare size={16} /> : <Mail size={16} />}
                  </div>
                  <div>
                    <div className="ah-name-row">
                      <strong>{log.recipient_name}</strong>
                      {log.status === 'sent' ? <CheckCircle size={14} className="c-green" /> : <XCircle size={14} className="c-red" />}
                    </div>
                    <div className="ah-rule-name">{log.rule_title}</div>
                    <div className="ah-meta">
                      <span className="ah-pill">{log.record_type} #{log.reference_number}</span>
                      <span className="ah-via">Vía {log.channel}</span>
                    </div>
                  </div>
                </div>
                <div className="ah-time">
                  <div className="hour">{format(new Date(log.created_at), "HH:mm")}</div>
                  <div className="date">{format(new Date(log.created_at), "d MMM", { locale: es })}</div>
                </div>
                <div className="ah-tooltip">"{log.message_text}"</div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .ah-container { display: flex; flex-direction: column; gap: 20px; width: 100%; }
        .ah-filter-grid { 
          display: grid; 
          grid-template-columns: 2fr 1fr 1fr 50px; 
          gap: 15px; 
          background: white; 
          padding: 20px; 
          border-radius: 16px; 
          border: 1px solid #e2e8f0;
          align-items: end;
        }
        .ah-search-box label, .ah-filter-box label {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 800; color: #94a3b8; margin-bottom: 8px;
        }
        .ah-search-box input, .ah-filter-box select {
          width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #cbd5e1;
          background: #f8fafc; font-size: 13px; outline: none;
        }
        .ah-refresh-btn {
          height: 40px; background: #224c22; color: white; border: none; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .ah-table-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
        .ah-scroll-area { max-height: 500px; overflow-y: auto; }
        .ah-row { 
          padding: 16px 20px; border-bottom: 1px solid #f1f5f9; 
          display: flex; justify-content: space-between; align-items: center;
          position: relative; transition: 0.2s;
        }
        .ah-row:hover { background: #f8fafc; }
        .ah-info { display: flex; gap: 15px; align-items: center; }
        .ah-icon-circle { width: 35px; height: 35px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        .ah-icon-circle.wa { background: #dcf8c6; color: #075e54; }
        .ah-icon-circle.em { background: #e0f2fe; color: #0284c7; }
        .ah-name-row { display: flex; align-items: center; gap: 8px; font-size: 14px; }
        .ah-rule-name { font-size: 12px; color: #64748b; margin: 2px 0 6px 0; }
        .ah-meta { display: flex; gap: 8px; align-items: center; }
        .ah-pill { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #475569; }
        .ah-via { font-size: 10px; color: #94a3b8; }
        .ah-time { text-align: right; }
        .ah-time .hour { font-size: 13px; font-weight: 800; color: #1e293b; }
        .ah-time .date { font-size: 10px; color: #94a3b8; }
        .c-green { color: #10b981; } .c-red { color: #ef4444; }
        .ah-tooltip {
          display: none; position: absolute; bottom: -40px; left: 50px; z-index: 10;
          background: #1e293b; color: white; padding: 8px 12px; border-radius: 8px; font-size: 11px;
          max-width: 300px; box-shadow: 0 10px 15px rgba(0,0,0,0.1);
        }
        .ah-row:hover .ah-tooltip { display: block; }
        .ah-loader { position: absolute; inset: 0; background: rgba(255,255,255,0.7); display: flex; align-items: center; justify-content: center; }
        .spinner { width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #224c22; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};