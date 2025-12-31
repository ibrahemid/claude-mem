import React, { useEffect } from 'react';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: string[];
  excludedProjects: Set<string>;
  onToggleProject: (project: string) => void;
  onEnableAll: () => void;
  onDisableAll: (projects: string[]) => void;
}

export function ProjectsModal({
  isOpen,
  onClose,
  projects,
  excludedProjects,
  onToggleProject,
  onEnableAll,
  onDisableAll
}: ProjectsModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const enabledCount = projects.filter(p => !excludedProjects.has(p)).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Projects</h2>
          <button onClick={onClose} className="modal-close-btn" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="projects-modal-body">
          <p className="projects-description">
            Toggle observation collection for each project. Disabled projects won't store new memories.
          </p>

          <div className="projects-summary">
            <span>{enabledCount} of {projects.length} enabled</span>
            <div className="projects-actions">
              <button className="projects-action-btn" onClick={onEnableAll}>
                Enable All
              </button>
              <button className="projects-action-btn" onClick={() => onDisableAll(projects)}>
                Disable All
              </button>
            </div>
          </div>

          <div className="projects-list">
            {projects.length === 0 ? (
              <div className="projects-empty">No projects found</div>
            ) : (
              projects.map(project => {
                const isEnabled = !excludedProjects.has(project);
                return (
                  <div key={project} className="project-row">
                    <span className="project-name">{project}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      className={`project-toggle ${isEnabled ? 'on' : ''}`}
                      onClick={() => onToggleProject(project)}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
