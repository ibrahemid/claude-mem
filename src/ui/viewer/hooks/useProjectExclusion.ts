import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'claude-mem-excluded-projects';

export function useProjectExclusion() {
  const [excludedProjects, setExcludedProjects] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {}
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...excludedProjects]));
  }, [excludedProjects]);

  const toggleProject = useCallback((project: string) => {
    setExcludedProjects(prev => {
      const next = new Set(prev);
      if (next.has(project)) {
        next.delete(project);
      } else {
        next.add(project);
      }
      return next;
    });
  }, []);

  const isExcluded = useCallback((project: string): boolean => {
    return excludedProjects.has(project);
  }, [excludedProjects]);

  const enableAll = useCallback(() => {
    setExcludedProjects(new Set());
  }, []);

  const disableAll = useCallback((projects: string[]) => {
    setExcludedProjects(new Set(projects));
  }, []);

  return {
    excludedProjects,
    toggleProject,
    isExcluded,
    enableAll,
    disableAll
  };
}
