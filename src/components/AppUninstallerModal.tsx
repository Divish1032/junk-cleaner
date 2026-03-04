import { X } from 'lucide-react';
import { AppUninstallerInfo, FileNode } from '../types';
import { formatSize } from './DiskTree';

interface AppUninstallerModalProps {
  info: AppUninstallerInfo | null;
  onClose: () => void;
  onReveal: (path: string) => void;
}

export function AppUninstallerModal({ info, onClose, onReveal }: AppUninstallerModalProps) {
  if (!info) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Uninstall {info.app_name}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <div className="app-info-card">
            <div className="app-info-row">
              <span className="info-label">App Path:</span>
              <span className="info-value path-text" title={info.app_path} onClick={() => onReveal(info.app_path)}>
                {info.app_path}
              </span>
            </div>
            <div className="app-info-row">
              <span className="info-label">Bundle ID:</span>
              <span className="info-value">{info.bundle_id || 'Unknown'}</span>
            </div>
            <div className="app-info-row highlight">
              <span className="info-label">Total Leftover Data:</span>
              <span className="info-value highlight-text">{formatSize(info.total_size)}</span>
            </div>
          </div>

          <h3>Related Files Found ({info.related_files.length})</h3>
          
          <div className="related-files-list">
            {info.related_files.length === 0 ? (
              <p className="empty-text">No related files found in common locations.</p>
            ) : (
              info.related_files.map((file: FileNode, i) => (
                <div key={i} className="related-file-row">
                  <div className="file-info-col">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="app-path-text" title={file.path} onClick={() => onReveal(file.path)}>
                      {file.path}
                    </span>
                  </div>
                  <span className="file-size shrink">{formatSize(file.size)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="modal-footer">
          <p className="footer-note">Note: For demonstration purposes. Deletion not implemented yet.</p>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
