import React from 'react';
import { FileNode } from '../types';
import { FolderOpen, File, ExternalLink, Trash2, Shield, HelpCircle, ChevronRight, ChevronDown } from 'lucide-react';

interface FileRowProps {
  node: FileNode;
  maxSize: number;
  depth?: number;
  onReveal: (path: string) => void;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatDate(unix: number): string {
  if (!unix) return '—';
  const d = new Date(unix * 1000);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getBarColor(node: FileNode): string {
  if (node.ai_classification === 'junk' || node.junk_category) return '#ef4444';
  if (node.ai_classification === 'important') return '#22c55e';
  if (node.ai_classification === 'unknown') return '#f59e0b';
  return '#6366f1';
}

function ClassificationBadge({ node }: { node: FileNode }) {
  if (node.junk_category && !node.ai_classification) {
    return (
      <span
        className="badge badge-junk"
        title={node.junk_category}
      >
        <Trash2 size={10} /> {node.junk_category}
      </span>
    );
  }
  if (node.ai_classification === 'junk') {
    return (
      <span className="badge badge-junk" title={node.ai_reason}>
        <Trash2 size={10} /> Likely Junk {node.ai_confidence ? `(${Math.round(node.ai_confidence * 100)}%)` : ''}
      </span>
    );
  }
  if (node.ai_classification === 'important') {
    return (
      <span className="badge badge-important" title={node.ai_reason}>
        <Shield size={10} /> Important
      </span>
    );
  }
  if (node.ai_classification === 'unknown') {
    return (
      <span className="badge badge-unknown" title={node.ai_reason}>
        <HelpCircle size={10} /> Unknown
      </span>
    );
  }
  return null;
}

export function FileRow({ node, maxSize, depth = 0, onReveal }: FileRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const pct = maxSize > 0 ? Math.max(node.size / maxSize, 0.003) : 0;
  const barColor = getBarColor(node);
  const hasChildren = node.children && node.children.length > 0;
  const childMaxSize = hasChildren
    ? Math.max(...node.children.map((c) => c.size))
    : 0;

  return (
    <>
      <div
        className={`file-row ${node.ai_classification === 'junk' || node.junk_category ? 'file-row--junk' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <div 
          className="file-row-clickable" 
          onClick={() => hasChildren && setExpanded((e) => !e)}
          style={{ cursor: hasChildren ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
        >
          {/* Expand toggle */}
          <button
            className="expand-btn"
            style={{ 
              visibility: hasChildren ? 'visible' : 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              marginRight: '4px'
            }}
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {/* Icon */}
          <span className="file-icon" style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
            {node.is_dir ? (
              <FolderOpen size={18} color="#f59e0b" />
            ) : (
              <File size={18} color="#94a3b8" />
            )}
          </span>

          {/* Name */}
          <span className="file-name" title={node.path} style={{ fontWeight: hasChildren ? 500 : 400 }}>
            {node.name}
          </span>
        </div>

        {/* Classification badge */}
        <ClassificationBadge node={node} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Usage bar */}
        <div className="usage-bar-wrap">
          <div
            className="usage-bar"
            style={{ width: `${Math.round(pct * 100)}%`, background: barColor }}
          />
        </div>

        {/* Size */}
        <span className="file-size">{formatSize(node.size)}</span>

        {/* Modified date */}
        <span className="file-date">{formatDate(node.modified)}</span>

        {/* Open in Finder button */}
        <button
          className="reveal-btn"
          title="Open in Finder / Explorer"
          onClick={() => onReveal(node.path)}
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="children-container">
          {node.children.map((child) => (
            <FileRow
              key={child.path}
              node={child}
              maxSize={childMaxSize}
              depth={depth + 1}
              onReveal={onReveal}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface DiskTreeProps {
  nodes: FileNode[];
  onReveal: (path: string) => void;
}

export function DiskTree({ nodes, onReveal }: DiskTreeProps) {
  const maxSize = nodes.length > 0 ? Math.max(...nodes.map((n) => n.size)) : 1;

  if (nodes.length === 0) {
    return (
      <div className="empty-state">
        <FolderOpen size={48} color="#334155" />
        <p>No data yet — choose a directory to scan</p>
      </div>
    );
  }

  return (
    <div className="disk-tree">
      {/* Header */}
      <div className="tree-header">
        <span style={{ flex: 1 }}>Name</span>
        <span className="col-bar">Usage</span>
        <span className="col-size">Size</span>
        <span className="col-date">Modified</span>
        <span className="col-action" />
      </div>
      {nodes.map((node) => (
        <FileRow key={node.path} node={node} maxSize={maxSize} onReveal={onReveal} />
      ))}
    </div>
  );
}
