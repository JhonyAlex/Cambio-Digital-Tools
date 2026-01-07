
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project } from '../../types';
import { getProjects, createNewProject, deleteProject, duplicateProject, saveProject } from '../../services/storageService';
import { useAppContext } from '../../hooks/useAppContext';
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
      const handleClick = () => setOpenMenuId(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      if (projectId) {
        const found = projects.find(p => p.id === projectId);
        if (found) setActiveProject(found);
        else navigate('/app/chronos', { replace: true });
      } else {
        setActiveProject(null);
      }
    }
  }, [projectId, projects, navigate]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const loaded = await getProjects();
      setProjects(loaded.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) { console.error("Failed to load projects", e); } 
    finally { setIsLoading(false); }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createNewProject(newProjectName);
      setNewProjectName('');
      setIsCreating(false);
      await loadProjects();
      navigate(`/app/chronos/${project.id}`);
    } catch (e) { alert("Error: " + e); }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm(t.deleteConfirm)) {
      try {
        await deleteProject(id);
        const remaining = projects.filter(p => p.id !== id);
        setProjects(remaining);
        if (projectId === id) navigate('/app/chronos');
      } catch (e) { alert("Error deleting project"); }
    }
  };

  const handleDuplicateProject = async (id: string) => {
      try { await duplicateProject(id); await loadProjects(); } 
      catch (e) { alert("Error duplicating project: " + e); }
  };

  const handleEditProject = (project: Project) => {
      setEditingProject(project);
      setEditName(project.name);
  };

  const handleSaveEdit = async () => {
      if(editingProject && editName.trim()) {
          const updated = { ...editingProject, name: editName.trim() };
          await saveProject(updated);
          setEditingProject(null);
          loadProjects();
      }
  };

  // VIEW: DETAIL
  if (activeProject && projectId) {
    return <KnowledgeBase initialProject={activeProject} apiConfig={apiConfig} onBack={() => { loadProjects(); navigate('/app/chronos'); }} />;
  }

  // VIEW: LIST
  return (
    <div className="h-full flex flex-col bg-[#0f172a]">
      
      {/* UNIFIED HEADER */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
             <span className="bg-blue-600 p-1.5 rounded-lg text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
             </span>
             {t.myProjects}
          </h1>
          <p className="text-slate-400 text-sm hidden md:block">{t.manageProjects}</p>
        </div>
        
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t.newProject}
        </button>
      </div>

      {/* CONTENT SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 relative">
          
          {isCreating && (
            <div className="max-w-2xl mx-auto mb-8 bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <input 
                autoFocus
                type="text" 
                placeholder={t.projectNamePlaceholder} 
                className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
              <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={handleCreateProject} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg transition-colors">{t.create}</button>
                  <button onClick={() => setIsCreating(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors">{t.cancel}</button>
              </div>
            </div>
          )}

          {editingProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
                      <h3 className="text-white font-bold mb-4 text-lg">{t.editProject}</h3>
                      <input 
                        autoFocus
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none mb-6"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <div className="flex justify-end gap-3">
                          <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">{t.cancel}</button>
                          <button onClick={handleSaveEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition-colors">{t.save}</button>
                      </div>
                  </div>
              </div>
          )}

          {isLoading && projects.length === 0 && (
             <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>{t.loadingProjects}</p>
             </div>
          )}

          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.length === 0 && !isCreating && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
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
                  onClick={() => navigate(`/app/chronos/${project.id}`)}
                  className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-blue-900/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                         <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-4.5 1.146z" />
                       </svg>
                    </div>
                    
                    <div className="relative">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); }}
                          className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                          </svg>
                        </button>

                        {/* Menu Dropdown */}
                        {openMenuId === project.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                <button onClick={(e) => { e.stopPropagation(); handleEditProject(project); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                    {t.rename}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDuplicateProject(project.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 border-t border-slate-800 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" /></svg>
                                    {t.duplicate}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2 border-t border-slate-800 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                    {t.delete}
                                </button>
                            </div>
                        )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 truncate" title={project.name}>{project.name}</h3>
                  
                  <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                      {project.files.length} {t.audios}
                    </span>
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default ChronosTool;
