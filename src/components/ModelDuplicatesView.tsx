import { ExternalLink, Copy } from 'lucide-react';
import { DuplicateGroup } from '../types';

interface ModelDuplicatesViewProps {
  groups: DuplicateGroup[];
  onReveal: (path: string) => void;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function ModelDuplicatesView({ groups, onReveal }: ModelDuplicatesViewProps) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <Copy size={32} opacity={0.5} />
        <p>No model duplicates found in common locations.</p>
      </div>
    );
  }

  const totalSavings = groups.reduce((acc, g) => acc + g.potential_savings, 0);

  return (
    <div className="junk-view">
      <div className="junk-summary">
        <Copy size={16} className="junk-icon" style={{ color: '#3b82f6' }} />
        <span>Found <strong>{groups.length}</strong> duplicated model groups.</span>
        <span className="junk-note" style={{ color: '#3b82f6' }}>
          Potential savings: {formatSize(totalSavings)}
        </span>
      </div>

      <div className="disk-tree">
        {groups.map((group, i) => (
          <div key={i} className="duplicate-group">
            <div className="duplicate-group-header">
              <span className="group-title">Model: {group.original.name}</span>
              <span className="group-savings">Savings: {formatSize(group.potential_savings)}</span>
            </div>

            <div className="duplicate-item original">
              <span className="item-badge original-badge">Original (Oldest)</span>
              <span className="item-path" onClick={() => onReveal(group.original.path)} title={group.original.path}>
                {group.original.path}
              </span>
              <button className="reveal-btn inline" onClick={() => onReveal(group.original.path)}>
                <ExternalLink size={12} />
              </button>
            </div>

            {group.duplicates.map((dup, j) => (
              <div key={j} className="duplicate-item duplicate">
                <span className="item-badge junk-badge">Duplicate</span>
                <span className="item-path" onClick={() => onReveal(dup.path)} title={dup.path}>
                  {dup.path}
                </span>
                <button className="reveal-btn inline" onClick={() => onReveal(dup.path)}>
                  <ExternalLink size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
