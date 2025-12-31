import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { API_BASE } from '../constants/api';

interface ShrinkCandidate {
  id: number;
  title: string | null;
  type: string;
  project: string;
  created_at_epoch: number;
  score: number;
  reasons: string[];
  tokenCount: number;
}

interface ShrinkAnalysis {
  candidates: ShrinkCandidate[];
  totalTokensSaved: number;
  observationsToRemove: number;
  totalObservations: number;
}

interface ShrinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: string;
}

type Step = 'config' | 'analysis' | 'executing' | 'complete';
type ShrinkMode = 'delete' | 'summarize';

function formatAge(epochSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const days = Math.floor((now - epochSeconds) / 86400);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
}

export function ShrinkModal({ isOpen, onClose, project }: ShrinkModalProps) {
  const [step, setStep] = useState<Step>('config');
  const [mode, setMode] = useState<ShrinkMode>('delete');
  const [targetReduction, setTargetReduction] = useState(30);
  const [minAge, setMinAge] = useState(30);
  const [analysis, setAnalysis] = useState<ShrinkAnalysis | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ deleted: number; failed: number; summarized?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setAnalysis(null);
      setSelectedIds(new Set());
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/shrink/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          targetReduction: targetReduction / 100,
          minAge
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json() as ShrinkAnalysis;
      setAnalysis(data);
      setSelectedIds(new Set(data.candidates.map(c => c.id)));
      setStep('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [project, targetReduction, minAge]);

  const handleExecute = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setStep('executing');
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/shrink/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observationIds: Array.from(selectedIds),
          mode
        })
      });

      if (!response.ok) {
        throw new Error('Shrink execution failed');
      }

      const data = await response.json();
      setResult({
        deleted: data.deleted || 0,
        failed: data.failed || 0,
        summarized: data.summarized || 0
      });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setStep('analysis');
    }
  }, [selectedIds, mode]);

  const toggleCandidate = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (analysis) {
      setSelectedIds(new Set(analysis.candidates.map(c => c.id)));
    }
  }, [analysis]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectOlderThan = useCallback((days: number) => {
    if (!analysis) return;
    const cutoff = Math.floor(Date.now() / 1000) - (days * 86400);
    const ids = analysis.candidates
      .filter(c => c.created_at_epoch < cutoff)
      .map(c => c.id);
    setSelectedIds(new Set(ids));
  }, [analysis]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  const selectedTokens = useMemo(() => {
    if (!analysis) return 0;
    return analysis.candidates
      .filter(c => selectedIds.has(c.id))
      .reduce((sum, c) => sum + c.tokenCount, 0);
  }, [analysis, selectedIds]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="shrink-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Shrink Memory</h2>
          <button onClick={onClose} className="modal-close-btn" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="shrink-modal-body">
          {step === 'config' && (
            <div className="shrink-config">
              <p className="shrink-description">
                Reduce memory footprint by processing low-value observations.
              </p>

              <div className="shrink-mode-selector">
                <button
                  className={`shrink-mode-btn ${mode === 'delete' ? 'active' : ''}`}
                  onClick={() => setMode('delete')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete
                </button>
                <button
                  className={`shrink-mode-btn ${mode === 'summarize' ? 'active' : ''}`}
                  onClick={() => setMode('summarize')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  Summarize
                </button>
              </div>

              <p className="shrink-mode-hint">
                {mode === 'delete'
                  ? 'Permanently remove selected observations from memory.'
                  : 'Compress observations into a summary while preserving key insights.'
                }
              </p>

              <div className="shrink-form">
                <div className="form-field">
                  <label>Target Reduction</label>
                  <div className="range-field">
                    <input
                      type="range"
                      min="10"
                      max="70"
                      value={targetReduction}
                      onChange={(e) => setTargetReduction(parseInt(e.target.value))}
                    />
                    <span className="range-value">{targetReduction}%</span>
                  </div>
                </div>

                <div className="form-field">
                  <label>Minimum age (days)</label>
                  <div className="range-field">
                    <input
                      type="range"
                      min="7"
                      max="365"
                      value={minAge}
                      onChange={(e) => setMinAge(parseInt(e.target.value))}
                    />
                    <span className="range-value">{minAge}</span>
                  </div>
                </div>

                {project && (
                  <div className="shrink-project-note">
                    Project: <strong>{project}</strong>
                  </div>
                )}
              </div>

              {error && <div className="shrink-error">{error}</div>}

              <div className="shrink-actions">
                <button className="shrink-action-btn secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="shrink-action-btn primary"
                  onClick={handleAnalyze}
                  disabled={isLoading}
                >
                  {isLoading ? 'Analyzing...' : 'Find Candidates'}
                </button>
              </div>
            </div>
          )}

          {step === 'analysis' && analysis && (
            <div className="shrink-analysis">
              <div className="shrink-summary">
                <div className="shrink-stat">
                  <span className="stat-value">{analysis.candidates.length}</span>
                  <span className="stat-label">candidates</span>
                </div>
                <div className="shrink-stat">
                  <span className="stat-value">{selectedIds.size}</span>
                  <span className="stat-label">selected</span>
                </div>
                <div className="shrink-stat">
                  <span className="stat-value">~{selectedTokens.toLocaleString()}</span>
                  <span className="stat-label">tokens</span>
                </div>
              </div>

              <div className="shrink-filters">
                <button onClick={selectAll} className="shrink-filter-btn">All</button>
                <button onClick={selectNone} className="shrink-filter-btn">None</button>
                <button onClick={() => selectOlderThan(30)} className="shrink-filter-btn">&gt;30d</button>
                <button onClick={() => selectOlderThan(60)} className="shrink-filter-btn">&gt;60d</button>
                <button onClick={() => selectOlderThan(90)} className="shrink-filter-btn">&gt;90d</button>
              </div>

              {analysis.candidates.length === 0 ? (
                <div className="shrink-empty">
                  <p>No candidates found with current settings.</p>
                  <p>Try increasing target reduction or lowering minimum age.</p>
                </div>
              ) : (
                <div className="shrink-candidates">
                  {analysis.candidates.map(candidate => (
                    <div
                      key={candidate.id}
                      className={`shrink-candidate ${selectedIds.has(candidate.id) ? 'selected' : ''}`}
                      onClick={() => toggleCandidate(candidate.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="candidate-info">
                        <div className="candidate-title">
                          {candidate.title || `Observation #${candidate.id}`}
                        </div>
                        <div className="candidate-meta">
                          <span className="candidate-type">{candidate.type}</span>
                          <span className="candidate-age">{formatAge(candidate.created_at_epoch)}</span>
                          <span className="candidate-tokens">{candidate.tokenCount}t</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="shrink-error">{error}</div>}

              <div className="shrink-actions">
                <button className="shrink-action-btn secondary" onClick={() => setStep('config')}>
                  Back
                </button>
                <button
                  className={`shrink-action-btn ${mode === 'delete' ? 'danger' : 'primary'}`}
                  onClick={handleExecute}
                  disabled={selectedIds.size === 0}
                >
                  {mode === 'delete' ? 'Delete' : 'Summarize'} ({selectedIds.size})
                </button>
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="shrink-executing">
              <div className="spinner-large"></div>
              <p>{mode === 'delete' ? 'Deleting' : 'Summarizing'} observations...</p>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="shrink-complete">
              <div className="shrink-complete-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3>Complete</h3>
              <p>
                {mode === 'delete'
                  ? `Deleted ${result.deleted} observation${result.deleted !== 1 ? 's' : ''}`
                  : `Summarized ${result.summarized || result.deleted} observation${(result.summarized || result.deleted) !== 1 ? 's' : ''}`
                }
                {result.failed > 0 && ` (${result.failed} failed)`}
              </p>
              <button className="shrink-action-btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
