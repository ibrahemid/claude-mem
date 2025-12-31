/**
 * ShrinkAnalyzer Service
 *
 * Analyzes observations to identify low-value items for deletion.
 * Scoring algorithm considers age, type, token count, and uniqueness.
 */

import { SessionStore, ObservationRecord } from '../sqlite/SessionStore.js';

export interface ShrinkCandidate {
  id: number;
  title: string | null;
  type: string;
  project: string;
  created_at_epoch: number;
  score: number;
  reasons: string[];
  tokenCount: number;
}

export interface ShrinkAnalysis {
  candidates: ShrinkCandidate[];
  totalTokensSaved: number;
  observationsToRemove: number;
  totalObservations: number;
}

export interface ShrinkOptions {
  project?: string;
  targetReduction?: number;
  minAge?: number;
  maxAge?: number;
  minScore?: number;
}

const TYPE_WEIGHTS: Record<string, number> = {
  decision: 1.0,
  bugfix: 0.9,
  feature: 0.8,
  refactor: 0.7,
  discovery: 0.5,
  change: 0.4
};

const CONCEPT_WEIGHTS: Record<string, number> = {
  'problem-solution': 1.0,
  'trade-off': 0.9,
  'why-it-exists': 0.8,
  'gotcha': 0.8,
  'how-it-works': 0.7,
  'pattern': 0.6,
  'what-changed': 0.4
};

export class ShrinkAnalyzer {
  constructor(private sessionStore: SessionStore) {}

  /**
   * Analyze observations and identify candidates for removal
   */
  analyze(options: ShrinkOptions = {}): ShrinkAnalysis {
    const {
      project,
      targetReduction = 0.3,
      minAge = 7,
      maxAge = 180,
      minScore = 0.6
    } = options;

    const db = this.sessionStore.db;
    const now = Date.now();
    const minAgeMs = minAge * 24 * 60 * 60 * 1000;
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;

    let query = `
      SELECT *
      FROM observations
      WHERE created_at_epoch < ?
    `;
    const params: any[] = [now - minAgeMs];

    if (project) {
      query += ` AND project = ?`;
      params.push(project);
    }

    query += ` ORDER BY created_at_epoch ASC`;

    const observations = db.prepare(query).all(...params) as ObservationRecord[];

    const totalCountQuery = project
      ? db.prepare('SELECT COUNT(*) as count FROM observations WHERE project = ?').get(project) as { count: number }
      : db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number };
    const totalObservations = totalCountQuery.count;

    const candidates: ShrinkCandidate[] = [];

    for (const obs of observations) {
      const score = this.calculateImportanceScore(obs, now, maxAgeMs);
      const tokenCount = this.estimateTokens(obs);

      if (score < minScore) {
        const reasons = this.generateReasons(obs, score, now, maxAgeMs);
        candidates.push({
          id: obs.id,
          title: obs.title,
          type: obs.type,
          project: obs.project,
          created_at_epoch: obs.created_at_epoch,
          score,
          reasons,
          tokenCount
        });
      }
    }

    candidates.sort((a, b) => a.score - b.score);

    const targetCount = Math.max(1, Math.floor(totalObservations * targetReduction));
    const finalCandidates = candidates.slice(0, targetCount);

    const totalTokensSaved = finalCandidates.reduce((sum, c) => sum + c.tokenCount, 0);

    return {
      candidates: finalCandidates,
      totalTokensSaved,
      observationsToRemove: finalCandidates.length,
      totalObservations
    };
  }

  /**
   * Calculate importance score for an observation (0-1, higher = more important)
   */
  private calculateImportanceScore(obs: ObservationRecord, now: number, maxAgeMs: number): number {
    let score = 0.5;

    const typeWeight = TYPE_WEIGHTS[obs.type] ?? 0.5;
    score += (typeWeight - 0.5) * 0.3;

    const ageMs = now - obs.created_at_epoch;
    const ageDecay = Math.max(0, 1 - (ageMs / maxAgeMs));
    score *= (0.5 + ageDecay * 0.5);

    if (obs.concepts) {
      try {
        const concepts = JSON.parse(obs.concepts) as string[];
        const maxConceptWeight = Math.max(...concepts.map(c => CONCEPT_WEIGHTS[c] ?? 0.5));
        score += (maxConceptWeight - 0.5) * 0.2;
      } catch {
        // Skip if concepts can't be parsed
      }
    }

    const narrativeLength = obs.narrative?.length ?? 0;
    const factsCount = obs.facts ? JSON.parse(obs.facts).length : 0;
    const contentScore = Math.min(1, (narrativeLength / 500 + factsCount / 5) / 2);
    score += contentScore * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Estimate token count for an observation
   */
  private estimateTokens(obs: ObservationRecord): number {
    let text = '';
    if (obs.title) text += obs.title + ' ';
    if (obs.subtitle) text += obs.subtitle + ' ';
    if (obs.narrative) text += obs.narrative + ' ';
    if (obs.facts) text += obs.facts + ' ';
    if (obs.concepts) text += obs.concepts + ' ';

    return Math.ceil(text.length / 4);
  }

  /**
   * Generate human-readable reasons for why an observation is a shrink candidate
   */
  private generateReasons(obs: ObservationRecord, score: number, now: number, maxAgeMs: number): string[] {
    const reasons: string[] = [];

    const ageMs = now - obs.created_at_epoch;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    if (ageDays > 30) {
      reasons.push(`${ageDays} days old`);
    }

    const typeWeight = TYPE_WEIGHTS[obs.type] ?? 0.5;
    if (typeWeight < 0.6) {
      reasons.push(`Low-priority type: ${obs.type}`);
    }

    const narrativeLength = obs.narrative?.length ?? 0;
    if (narrativeLength < 50) {
      reasons.push('Minimal content');
    }

    if (score < 0.2) {
      reasons.push('Very low importance score');
    }

    return reasons;
  }

  /**
   * Execute shrink operation by deleting specified observations
   */
  async executeShrink(observationIds: number[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const id of observationIds) {
      const success = this.sessionStore.deleteObservationById(id);
      if (success) {
        deleted++;
      } else {
        failed++;
      }
    }

    return { deleted, failed };
  }
}
