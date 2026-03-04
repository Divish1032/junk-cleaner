import { FileNode } from '../types';
import { formatSize, formatDate } from './DiskTree';
import { ExternalLink, Trash2, AlertTriangle } from 'lucide-react';

interface JunkViewProps {
  knownJunk: FileNode[];
  aiJunk: FileNode[];
  onReveal: (path: string) => void;
}

export function JunkView({ knownJunk, aiJunk, onReveal }: JunkViewProps) {
  const allJunk = [
    ...knownJunk,
    ...aiJunk.filter(
      (n) =>
        n.ai_classification === 'junk' &&
        !knownJunk.some((k) => k.path === n.path)
    ),
  ].sort((a, b) => b.size - a.size);

  const totalJunkSize = allJunk.reduce((sum, n) => sum + n.size, 0);

  if (allJunk.length === 0) {
    return (
      <div className="empty-state">
        <Trash2 size={48} color="#334155" />
        <p>No junk identified yet. Run a scan or use AI analysis.</p>
      </div>
    );
  }

  return (
    <div className="junk-view">
      <div className="junk-summary">
        <AlertTriangle size={20} color="#ef4444" />
        <span>
          <strong>{allJunk.length}</strong> potential junk items &nbsp;|&nbsp; Total:{' '}
          <strong style={{ color: '#ef4444' }}>{formatSize(totalJunkSize)}</strong>
        </span>
        <span className="junk-note">⚠️ Use "Open in Finder" to review before deleting manually.</span>
      </div>

      <div className="disk-tree">
        <div className="tree-header">
          <span>Category</span>
          <span style={{ flex: 1, marginLeft: 8 }}>Path</span>
          <span className="col-size">Size</span>
          <span className="col-date">Modified</span>
          <span className="col-action" />
        </div>

        {allJunk.map((node) => (
          <div key={node.path} className="file-row file-row--junk">
            <span className="file-icon">
              <Trash2 size={16} color="#ef4444" />
            </span>
            <div className="junk-category-label">
              {node.junk_category || node.ai_classification === 'junk'
                ? (node.junk_category || 'AI Detected Junk')
                : 'Unknown'}
            </div>
            <span className="file-name junk-path" title={node.path}>
              {node.path}
            </span>
            <div className="flex-1" />
            <span className="file-size">{formatSize(node.size)}</span>
            <span className="file-date">{formatDate(node.modified)}</span>
            <button
              className="reveal-btn"
              title="Open in Finder / Explorer"
              onClick={() => onReveal(node.path)}
            >
              <ExternalLink size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
