import React from 'react';
import { 
  X, 
  Plane, 
  Ship, 
  Package, 
  FileCheck, 
  MapPin, 
  CheckCircle2, 
  UserCircle 
} from 'lucide-react';

interface Activity {
  id: string;
  at: string;
  status: string;
  actor_email: string;
  shipments: {
    code: string;
    product_mode: 'Aérea' | 'Marítima';
  };
}

interface StaffMember {
  id: string;
  email: string;
  last_sign_in_at: string;
  role: string;
}

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activities: Activity[];
  onlineStaff: StaffMember[];
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({ 
  isOpen, 
  onClose, 
  activities, 
  onlineStaff 
}) => {
  
  // Función para obtener el icono dinámico según estado y modo
  const getStatusIcon = (status: string, mode: string) => {
    switch (status) {
      case 'CREATED': return <Package size={18} className="text-gray-400" />;
      case 'PACKED': return <Package size={18} className="text-blue-500" />;
      case 'DOCS_READY': return <FileCheck size={18} className="text-purple-500" />;
      case 'ARRIVED_PTY': return <MapPin size={18} className="text-orange-500" />;
      case 'DEPARTED': 
        return mode === 'Aérea' 
          ? <Plane size={18} className="text-indigo-500" /> 
          : <Ship size={18} className="text-indigo-500" />;
      case 'AT_DESTINATION': return <CheckCircle2 size={18} className="text-green-500" />;
      default: return <UserCircle size={18} />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="ff-drawer-overlay" onClick={onClose} />
      
      <div className={`ff-drawer ${isOpen ? 'is-open' : ''}`}>
        <div className="ff-drawer__header">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Centro de Control</h2>
            <p className="text-xs text-gray-500">Monitoreo de Staff en tiempo real</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Sección de Presencia de Staff */}
        <div className="ff-drawer__section">
          <h3 className="section-title">Equipo Staff</h3>
          <div className="staff-grid">
            {onlineStaff.map((member) => (
              <div key={member.id} className="staff-card">
                <div className="staff-avatar">
                  {member.email.substring(0, 2).toUpperCase()}
                  <span className="status-indicator online" />
                </div>
                <div className="staff-info">
                  <p className="staff-email">{member.email}</p>
                  <p className="staff-role">{member.role.toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Muro de Actividad */}
        <div className="ff-drawer__section flex-1 overflow-y-auto">
          <h3 className="section-title">Actividad Reciente</h3>
          <div className="activity-timeline">
            {activities.map((act) => (
              <div key={act.id} className="activity-item">
                <div className="activity-icon-container">
                  {getStatusIcon(act.status, act.shipments.product_mode)}
                  <div className="timeline-line" />
                </div>
                <div className="activity-details">
                  <p className="activity-text">
                    <span className="font-semibold text-gray-700">{act.actor_email.split('@')[0]}</span>
                    {' actualizó '}
                    <span className="text-ff-green font-mono">{act.shipments.code}</span>
                  </p>
                  <p className="activity-status-label">{act.status.replace('_', ' ')}</p>
                  <span className="activity-time">{formatTime(act.at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};