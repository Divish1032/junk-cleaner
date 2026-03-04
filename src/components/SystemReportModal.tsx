import { X, Activity, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SystemReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: string;
  isGenerating: boolean;
}

export function SystemReportModal({
  isOpen,
  onClose,
  report,
  isGenerating,
}: SystemReportModalProps) {
  if (!isOpen) return null;

  const isError = report.startsWith('⚠️');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Activity size={24} style={{ color: '#10b981' }} />
          AI System Health Report
        </h2>

        {isGenerating ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <div className="scan-spinner" style={{ margin: '0 auto 16px auto', borderTopColor: '#10b981' }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Analyzing system disk volumes and top large files...</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>This may take 30-120 seconds depending on your model speed.</p>
          </div>
        ) : isError ? (
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '30px',
            background: 'rgba(239, 68, 68, 0.07)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
          }}>
            <AlertTriangle size={32} color="#fca5a5" />
            <p style={{ color: '#fca5a5', textAlign: 'center' }}>{report.replace('⚠️ ', '')}</p>
          </div>
        ) : (
          <div style={{ 
            lineHeight: '1.7', 
            background: 'var(--bg-base)', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            maxHeight: '65vh',
            overflowY: 'auto',
            fontSize: '13px',
          }}>
            <ReactMarkdown>{report || 'No report generated.'}</ReactMarkdown>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
