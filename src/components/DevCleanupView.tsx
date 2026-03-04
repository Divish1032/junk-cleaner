/**
 * DevCleanupView — READ-ONLY
 * This view scans for regeneratable dev artifacts and surfaces them so the
 * developer can make informed decisions. It NEVER deletes, modifies, or adds
 * any file. Actions are limited to:
 *   • Open in Finder
 *   • Copy absolute path to clipboard
 *   • Ask AI (opens Chat pre-filled with the artifact path)
 */
import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight,
  RefreshCw, Loader2, PackageOpen,
  FolderOpen, Clipboard, MessageSquare, Terminal
} from 'lucide-react';
import { DevArtifact } from '../types';

interface Props {
  artifacts: DevArtifact[];
  scanning: boolean;
  onRefresh: () => void;
  onReveal: (path: string) => void;
  onAskAI: (path: string) => void;
}

const ECOSYSTEM_COLORS: Record<string, string> = {
  'Node.js': '#68a063',
  'Next.js': '#aaaaaa',
  'Nuxt.js': '#00C58E',
  'Turborepo': '#EF4444',
  'Vite': '#AC81FE',
  'Node.js / Frontend': '#f0db4f',
  'Rust / Cargo': '#CE4A00',
  'Python': '#3776ab',
  'Go / PHP': '#00ADD8',
  'Generic Build': '#6b7280',
  'Java / Android': '#3DDC84',
  'Flutter / Dart': '#54C5F8',
  'iOS / macOS (CocoaPods)': '#fa7343',
  'Swift / SPM': '#FA7343',
  'Xcode': '#1D6FA4',
  'SvelteKit': '#FF3E00',
};

function ecosystemColor(eco: string): string {
  return ECOSYSTEM_COLORS[eco] ?? '#6366f1';
}

function formatBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback for non-secure contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export function DevCleanupView({ artifacts, scanning, onRefresh, onReveal, onAskAI }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Group by ecosystem, sorted by total size desc
  const groups = useMemo(() => {
    const map = new Map<string, DevArtifact[]>();
    for (const a of artifacts) {
      if (!map.has(a.ecosystem)) map.set(a.ecosystem, []);
      map.get(a.ecosystem)!.push(a);
    }
    return [...map.entries()].sort(
      (a, b) =>
        b[1].reduce((s, x) => s + x.size_bytes, 0) -
        a[1].reduce((s, x) => s + x.size_bytes, 0)
    );
  }, [artifacts]);

  const totalSavings = useMemo(() => artifacts.reduce((s, a) => s + a.size_bytes, 0), [artifacts]);

  const toggleCollapse = (eco: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(eco) ? next.delete(eco) : next.add(eco);
      return next;
    });
  };

  const handleCopy = async (path: string) => {
    await copyToClipboard(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const handleAskAI = (artifact: DevArtifact) => {
    const prompt = `[FILE_ANALYSIS] Tell me about this dev artifact directory:
Path: ${artifact.path}
Ecosystem: ${artifact.ecosystem}
Artifact type: ${artifact.artifact_name} (${artifact.description})
Approximate size: ${formatBytes(artifact.size_bytes)}
Project: ${artifact.project_name}

Is this safe to delete and regenerate? What does this folder contain and what command regenerates it? Any potential risks I should know?`;
    onAskAI(prompt);
  };

  // ── Loading state ────────────────────────────────────────
  if (scanning) {
    return (
      <div className="dev-cleanup-view empty-state">
        <Loader2 size={36} className="spin" style={{ color: '#6366f1' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Scanning dev projects…</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>This may take a moment for large directories</div>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────
  if (artifacts.length === 0) {
    return (
      <div className="dev-cleanup-view empty-state">
        <PackageOpen size={48} style={{ color: 'var(--text-muted)' }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No dev artifacts found</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Scan your home or project directory to discover regeneratable build folders.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onRefresh} style={{ marginTop: 8 }}>
          <RefreshCw size={14} /> Scan Again
        </button>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────
  return (
    <div className="dev-cleanup-view">
      {/* Header bar */}
      <div className="dev-cleanup-header">
        <div className="dev-cleanup-stat">
          <span className="dcs-num">{artifacts.length}</span>
          <span className="dcs-label">artifacts found</span>
        </div>
        <div className="dev-cleanup-stat">
          <span className="dcs-num" style={{ color: '#fbbf24' }}>{formatBytes(totalSavings)}</span>
          <span className="dcs-label">potentially recoverable</span>
        </div>
        <div className="dev-cleanup-stat">
          <span className="dcs-num" style={{ color: '#818cf8' }}>{groups.length}</span>
          <span className="dcs-label">ecosystems</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={onRefresh}>
            <RefreshCw size={13} /> Rescan
          </button>
        </div>
      </div>

      {/* Read-only notice */}
      <div className="dev-readonly-notice">
        🔒 Read-only view — use the action icons to open in Finder, copy path, or ask the AI chat about any artifact.
      </div>

      {/* Groups */}
      <div className="dev-cleanup-list">
        {groups.map(([ecosystem, items]) => {
          const collapsed = collapsedGroups.has(ecosystem);
          const groupSize = items.reduce((s, a) => s + a.size_bytes, 0);
          const color = ecosystemColor(ecosystem);

          return (
            <div key={ecosystem} className="dev-group">
              {/* Group header */}
              <div className="dev-group-header" onClick={() => toggleCollapse(ecosystem)}>
                <div className="dev-ecosystem-dot" style={{ background: color }} />
                <span className="dev-group-name">{ecosystem}</span>
                <span className="dev-group-count">{items.length} folder{items.length > 1 ? 's' : ''}</span>
                <span className="dev-group-size">{formatBytes(groupSize)}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>

              {/* Artifact rows */}
              {!collapsed && (
                <div className="dev-group-items">
                  {items.map(artifact => (
                    <div key={artifact.path} className="dev-artifact-row">
                      <FolderOpen size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />

                      <div className="dev-artifact-info">
                        <div className="dev-artifact-title">
                          <span className="dev-project-name">{artifact.project_name}</span>
                          <span className="dev-sep">/</span>
                          <span className="dev-artifact-name" style={{ color }}>{artifact.artifact_name}</span>
                          <span className="dev-artifact-size-inline">{formatBytes(artifact.size_bytes)}</span>
                        </div>
                        <div className="dev-artifact-path" title={artifact.path}>{artifact.path}</div>
                        <div className="dev-artifact-desc">{artifact.description}</div>
                        <div className="dev-regen-cmd" title={`Regenerate with: ${artifact.regen_command}`}>
                          <Terminal size={10} />
                          <span>{artifact.regen_command}</span>
                        </div>
                      </div>

                      {/* Action icons */}
                      <div className="dev-artifact-actions">
                        <button
                          className="icon-btn action-icon"
                          title="Open in Finder"
                          onClick={() => onReveal(artifact.path)}
                        >
                          <FolderOpen size={14} />
                        </button>
                        <button
                          className={`icon-btn action-icon ${copiedPath === artifact.path ? 'copied' : ''}`}
                          title="Copy absolute path"
                          onClick={() => handleCopy(artifact.path)}
                        >
                          <Clipboard size={14} />
                        </button>
                        <button
                          className="icon-btn action-icon action-icon--ai"
                          title="Ask AI about this artifact"
                          onClick={() => handleAskAI(artifact)}
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
