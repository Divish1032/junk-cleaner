import React from 'react';
import { X, Activity } from 'lucide-react';
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Activity size={24} style={{ color: 'var(--accent)' }} />
          AI System Health Report
        </h2>

        {isGenerating ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="scan-spinner" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ color: 'var(--text-muted)' }}>Analyzing system disk volumes and top large files...</p>
          </div>
        ) : (
          <div style={{ 
            lineHeight: '1.6', 
            background: 'var(--bg-base)', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}>
            <ReactMarkdown>{report || 'No report generated.'}</ReactMarkdown>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
