import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project } from '../../types';
import { getProjects, createNewProject, deleteProject } from '../../services/storageService';
import { useAppContext } from '../../App';
import KnowledgeBase from '../KnowledgeBase';

const ChronosTool: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { apiConfig, t } = useAppContext();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initial Load
  useEffect(() => {
    loadProjects();
  }, []);

  // Watch ID param for Deep Linking
  useEffect(() => {
    if (projects.length > 0) {
      if (projectId) {
        const found = projects.find(p => p.id === projectId);
        if (found) {
          setActiveProject(found);
        } else {
          // ID invalid? Redirect to list
          navigate('/app/chronos', { replace: true });
        }
      } else {
        setActiveProject(null);
      }
    }
  }, [projectId, projects, navigate]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const loaded = await getProjects();
      const sorted = loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      setProjects(sorted);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createNewProject(newProjectName);
      setNewProjectName('');
      setIsCreating(false);
      await loadProjects();
      // Navigate to new project URL
      navigate(`/app/chronos/${project.id}`);
    } catch (e) {
      alert("Error: " + e);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(t.deleteConfirm)) {
      try {
        await deleteProject(id);
        const remaining = projects.filter(p => p.id !== id);
        setProjects(remaining);
        
        if (projectId === id) {
          navigate('/app/chronos');
        }
      } catch (e) {
        alert("Error deleting project");
      }
    }
  };

  const handleOpenProject = (project: Project) => {
    // URL Update
    navigate(`/app/chronos/${project.id}`);
  };

  const handleBack = () => {
    // Refresh list data to show new updates (e.g. file counts changed)
    loadProjects(); 
    navigate('/app/chronos');
  };

  // --- VIEW: PROJECT DETAIL (If URL has ID) ---
  if (activeProject && projectId) {
    return (
      <KnowledgeBase 
        initialProject={activeProject} 
        apiConfig={apiConfig} 
        onBack={handleBack}
      />
    );
  }

  // --- VIEW: PROJECT LIST ---
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-20 p-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t.myProjects}</h2>
          <p className="text-slate-400">{t.manageProjects}</p>
        </div>
        
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t.newProject}
        </button>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <div className="mb-8 bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <input 
            autoFocus
            type="text" 
            placeholder={t.projectNamePlaceholder} 
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
          />
          <button onClick={handleCreateProject} className="text-blue-400 hover:text-blue-300 font-bold px-3">{t.create}</button>
          <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-white px-3">{t.cancel}</button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && projects.length === 0 && (
         <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">{t.loadingProjects}</p>
         </div>
      )}

      {/* Project Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 && !isCreating && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <p className="text-lg font-medium">{t.noProjects}</p>
              <p className="text-sm">{t.noProjectsSub}</p>
            </div>
          )}

          {projects.map(project => (
            <div 
              key={project.id}
              onClick={() => handleOpenProject(project)}
              className="group relative bg-slate-800 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/80 transition-all hover:-translate-y-1 shadow-lg hover:shadow-blue-900/10"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 text-blue-400 rounded-xl flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                     <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-4.5 1.146z" />
                   </svg>
                </div>
                <button 
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  className="text-slate-500 hover:text-red-400 p-2 rounded-full hover:bg-slate-700/50 transition-colors"
                  title="Eliminar proyecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 truncate">{project.name}</h3>
              
              <div className="flex items-center gap-4 text-sm text-slate-400 mt-4">
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  {project.files.length} {t.audios}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChronosTool;