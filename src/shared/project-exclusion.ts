/**
 * Project Exclusion Utility
 *
 * Provides functions to check if a project should be excluded from observation collection.
 * Exclusion is configured via CLAUDE_MEM_EXCLUDED_PROJECTS setting (comma-separated list).
 */

import path from 'path';
import { SettingsDefaultsManager } from './SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from './paths.js';

/**
 * Check if a project is excluded from observation collection.
 * @param cwd - The current working directory (project root)
 * @returns true if the project should be excluded, false otherwise
 */
export function isProjectExcluded(cwd: string): boolean {
  const project = path.basename(cwd);
  const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
  const excludedProjectsStr = settings.CLAUDE_MEM_EXCLUDED_PROJECTS || '';

  if (!excludedProjectsStr.trim()) {
    return false;
  }

  const excludedProjects = new Set(
    excludedProjectsStr
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(p => p.length > 0)
  );

  return excludedProjects.has(project.toLowerCase());
}
