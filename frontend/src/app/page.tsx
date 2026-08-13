'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import {
  createTaskApi,
  Task,
  ReportData
} from '../lib/store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Plus, CheckCircle2, ListTodo, Activity, RotateCcw, 
  MessageSquarePlus, BarChart3, Clock, LayoutDashboard, LogOut
} from 'lucide-react';

export default function Page() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isGuestMode, setIsGuestMode] = useState(false);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400 font-medium">Loading...</div>;
  }

  const showDashboard = isSignedIn || isGuestMode;

  if (!showDashboard) {
    return (
      <main className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center animate-in fade-in duration-700">
        <div className="bg-[var(--color-primary)]/10 p-6 rounded-2xl border border-[var(--color-primary)]/20 shadow-sm mb-6">
          <LayoutDashboard size={64} className="text-[var(--color-primary)]" />
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight text-stone-100 font-heading mb-4">
          TaskLedger <span className="text-[var(--color-cta)]">AI</span>
        </h1>
        <p className="text-xl text-stone-400 font-light max-w-2xl mx-auto mb-10">
          Manage your tasks and use Machine Learning to predict how long they will take. Sign in to sync your data securely.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <SignInButton mode="modal">
            <button className="cta-button glass-button px-8 py-4 rounded-xl font-bold text-white text-lg min-w-[200px]">
              Sign In
            </button>
          </SignInButton>
          <button 
            onClick={() => setIsGuestMode(true)}
            className="glass-button px-8 py-4 rounded-xl font-bold text-stone-300 hover:text-white text-lg transition-colors border border-white/10 min-w-[200px]"
          >
            Try as Guest
          </button>
        </div>
      </main>
    );
  }

  return <Dashboard getToken={getToken} isGuestMode={isGuestMode} setIsGuestMode={setIsGuestMode} />;
}

function Dashboard({ getToken, isGuestMode, setIsGuestMode }: { getToken: any, isGuestMode: boolean, setIsGuestMode: any }) {
  const api = useMemo(() => createTaskApi(getToken, isGuestMode), [getToken, isGuestMode]);

  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskComplexity, setNewTaskComplexity] = useState<number>(5);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [expandedCompletedTaskId, setExpandedCompletedTaskId] = useState<number | null>(null);
  const [newLogNote, setNewLogNote] = useState('');

  // Add Past Task state
  const [showAddPastModal, setShowAddPastModal] = useState(false);
  const [pastTaskName, setPastTaskName] = useState('');
  const [pastTaskComplexity, setPastTaskComplexity] = useState(5);
  const [pastTaskStartDate, setPastTaskStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [pastTaskDays, setPastTaskDays] = useState<number | ''>(1);
  const [isSubmittingPast, setIsSubmittingPast] = useState(false);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const data = await api.getTasks();
      setActiveTasks(data.active);
      setCompletedTasks(data.completed);
      
      if (!isGuestMode && !hasCheckedOnboarding && data.completed.length === 0 && !isLoadingTasks) {
        setShowOnboarding(true);
      }
      setHasCheckedOnboarding(true);
    } catch (err) {
      console.error("Task API failed", err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [api, isGuestMode, hasCheckedOnboarding, isLoadingTasks]);

  useEffect(() => {
    loadTasks();
  }, [api]); // Intentionally simpler dependency array to avoid infinite loops

  useEffect(() => {
    setPrediction(null);
  }, [newTaskComplexity]);

  const isDuplicate = activeTasks.some(t => t.name.toLowerCase() === newTaskName.trim().toLowerCase());

  const handlePredict = async () => {
    if (!newTaskName.trim()) return;
    setIsPredicting(true);
    try {
      const data = await api.predictDuration(newTaskComplexity);
      setPrediction(data.predicted_days);
    } catch (err) {
      console.error("Prediction API failed", err);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || isDuplicate || isPredicting) return;
    try {
      await api.addTask(newTaskName, newTaskComplexity);
      await loadTasks();
      setNewTaskName('');
      setNewTaskComplexity(5);
      setPrediction(null);
    } catch (err) {
      console.error("Add task failed", err);
    }
  };

  const handleAddLog = async (index: number) => {
    if (!newLogNote.trim()) return;
    try {
      await api.logProgress(activeTasks[index].name, newLogNote.trim());
      await loadTasks();
      setNewLogNote('');
    } catch (err) {
      console.error("Log progress failed", err);
    }
  };

  const handleCompleteTask = async (index: number) => {
    try {
      await api.completeTask(activeTasks[index].name);
      await loadTasks();
    } catch (err) {
      console.error("Complete task failed", err);
    }
  };

  const handleReopen = async (realIndex: number) => {
    try {
      await api.reopenTask(completedTasks[realIndex].name);
      await loadTasks();
    } catch (err) {
      console.error("Reopen task failed", err);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const data = await api.generateReport(completedTasks);
      setReportData(data);
    } catch (err) {
      console.error("Report API failed", err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAddPastTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastTaskName.trim() || isSubmittingPast || pastTaskDays === '') return;
    setIsSubmittingPast(true);
    try {
      await api.addPastTask(pastTaskName, pastTaskComplexity, pastTaskStartDate, Number(pastTaskDays));
      await loadTasks();
      setShowAddPastModal(false);
      setPastTaskName('');
      setPastTaskComplexity(5);
      setPastTaskDays(1);
    } catch (err) {
      console.error("Add past task failed", err);
    } finally {
      setIsSubmittingPast(false);
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="text-center space-y-4 pt-10 pb-6 flex flex-col items-center relative">
        <div className="absolute top-0 right-0 flex items-center gap-4">
          {isGuestMode && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Guest Mode (Local Storage)
            </span>
          )}
          {isGuestMode ? (
            <button 
              onClick={() => setIsGuestMode(false)}
              className="text-stone-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <LogOut size={16} /> Exit Guest Mode
            </button>
          ) : (
            <UserButton />
          )}
        </div>

        <div className="bg-[var(--color-primary)]/10 p-4 rounded-2xl border border-[var(--color-primary)]/20 shadow-sm mb-2 mt-8 md:mt-0">
          <LayoutDashboard size={40} className="text-[var(--color-primary)]" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-stone-100 font-heading">
          TaskLedger <span className="text-[var(--color-cta)]">AI</span>
        </h1>
        <p className="text-xl text-stone-400 font-light max-w-2xl mx-auto">
          Manage your tasks and use Machine Learning to predict how long they will take.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          {/* Add Task Panel */}
          <section className="glass-panel p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-stone-100 font-heading">
              <Plus className="text-[var(--color-primary)]" /> New Task
            </h2>
            <form onSubmit={handleAddTask} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-400 mb-2">Task Name</label>
                <input 
                  type="text" 
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className={`glass-input w-full p-4 rounded-xl text-lg ${isDuplicate ? 'border-red-500/50 focus:border-red-500' : ''}`}
                  placeholder="e.g., Optimize Database Queries"
                  required
                />
                {isDuplicate && (
                  <p className="text-red-500 text-xs mt-2 font-medium">Task already exists.</p>
                )}
              </div>
              
              <div className={`space-y-6 transition-all duration-300 overflow-hidden ${newTaskName.trim().length > 0 ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div>
                  <label className="block text-sm font-medium text-stone-400 mb-4 flex justify-between">
                    <span>Complexity Score</span>
                    <span className="bg-violet-500/20 text-violet-300 px-3 py-1 rounded-full text-xs font-bold border border-violet-500/20">
                      {newTaskComplexity} / 10
                    </span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="10" 
                    value={newTaskComplexity}
                    onChange={e => setNewTaskComplexity(parseInt(e.target.value))}
                    className="w-full accent-violet-500 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <button 
                    type="button" 
                    onClick={handlePredict}
                    disabled={isPredicting || isDuplicate}
                    className="glass-button flex-1 py-4 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                  >
                    <Activity size={18} />
                    {isPredicting && prediction === null ? 'Thinking...' : (prediction !== null ? `Est: ~${prediction} Days` : 'Predict Duration')}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isDuplicate || isPredicting}
                    className="cta-button glass-button flex-1 py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                  >
                    <Plus size={20} /> Create Task
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Active Tasks Panel */}
          <section className="glass-panel p-8 flex flex-col min-h-[400px]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-stone-100 font-heading">
              <ListTodo className="text-[var(--color-primary)]" /> Active Tasks
              <span className="ml-auto bg-[var(--color-primary)]/20 text-violet-300 text-xs px-3 py-1 rounded-full font-bold">{activeTasks.length}</span>
            </h2>
            
            {isLoadingTasks && activeTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-500 opacity-70 py-10 space-y-4">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
                <p>Loading tasks...</p>
              </div>
            ) : activeTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-500 opacity-70 py-10">
                <CheckCircle2 size={48} className="mb-4 text-emerald-400" />
                <p>You are all caught up!</p>
              </div>
            ) : (
              <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {activeTasks.map((task, i) => (
                  <li key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 shadow-sm hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-lg text-stone-100 mb-1">{task.name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                          <span className="bg-white/10 text-stone-300 px-2 py-1 rounded font-medium">C:{task.complexity}</span>
                          <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded"><Clock size={12}/> {task.start_date}</span>
                          {task.predicted_days !== undefined && (
                            <span className="text-orange-300 font-medium bg-orange-500/20 px-2 py-1 rounded border border-orange-500/20">
                              ~{task.predicted_days}d
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button 
                          onClick={() => setExpandedTaskId(expandedTaskId === i ? null : i)}
                          className="px-3 py-2 flex items-center gap-2 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 transition-colors text-sm font-medium border border-white/10"
                          title="Progress Logs"
                        >
                          <MessageSquarePlus size={16} /> Logs
                        </button>
                        <button 
                          onClick={() => handleCompleteTask(i)}
                          className="px-3 py-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/30 text-sm font-medium"
                          title="Complete Task"
                        >
                          <CheckCircle2 size={16} /> Complete
                        </button>
                      </div>
                    </div>
                    
                    {expandedTaskId === i && (
                      <div className="mt-5 pt-5 border-t border-white/10 animate-in slide-in-from-top-2">
                        {task.progress_log && task.progress_log.length > 0 ? (
                          <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-2">
                            {task.progress_log.map((log, logIdx) => (
                              <div key={logIdx} className="bg-black/20 p-3 rounded-lg border border-white/5 flex gap-3 text-sm">
                                <span className="text-stone-500 font-mono text-xs whitespace-nowrap mt-0.5">{log.date.slice(5)}</span>
                                <span className="text-stone-300">{log.note}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-stone-500 italic mb-4">No logs yet.</p>
                        )}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newLogNote}
                            onChange={e => setNewLogNote(e.target.value)}
                            className="glass-input flex-1 p-3 rounded-lg text-sm bg-black/20"
                            placeholder="Type progress update..."
                            onKeyDown={e => e.key === 'Enter' && handleAddLog(i)}
                          />
                          <button 
                            onClick={() => handleAddLog(i)}
                            className="glass-button px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Analytics Panel */}
          <section className="glass-panel p-8 flex flex-col min-h-[400px]">
             <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold flex items-center gap-3 text-stone-100 font-heading">
                <BarChart3 className="text-[var(--color-primary)]" /> AI Insights
               </h2>
               {reportData && (
                 <button 
                   onClick={generateReport}
                   disabled={isGeneratingReport}
                   className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-stone-300 transition-colors"
                 >
                   Refresh
                 </button>
               )}
             </div>
            
            {reportData ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div>
                  <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Avg Days by Complexity</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.complexity_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="complexity" stroke="#78716c" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#78716c" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                          contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f5f5f4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                        />
                        <Bar dataKey="days_taken" radius={[4, 4, 0, 0]}>
                          {reportData.complexity_data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="url(#colorUv)" />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={1}/>
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Completion by Day</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.day_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="day" stroke="#78716c" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v.slice(0,3)} />
                        <YAxis stroke="#78716c" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                          contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f5f5f4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                        />
                        <Bar dataKey="count" fill="#fb923c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <BarChart3 size={48} className="text-stone-700 mb-4" />
                <p className="text-stone-500 max-w-xs mb-6">Need at least 3 completed tasks to generate AI productivity charts.</p>
                <button 
                  onClick={generateReport}
                  disabled={isGeneratingReport || completedTasks.length < 3}
                  className="glass-button px-8 py-3 rounded-xl font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingReport ? 'Analyzing...' : 'Generate Report'}
                </button>
              </div>
            )}
          </section>

          {/* Completed Tasks Panel */}
          <section className="glass-panel p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-stone-100 font-heading">
                <CheckCircle2 className="text-emerald-400" /> Completed
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs px-3 py-1 rounded-full">
                  {completedTasks.length}
                </span>
              </h2>
              <button 
                onClick={() => setShowAddPastModal(true)}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
              >
                + Add Past Task
              </button>
            </div>
            {isLoadingTasks && completedTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-500 opacity-70 py-10 space-y-4">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p>Loading...</p>
              </div>
            ) : (
            <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {completedTasks.slice().reverse().map((task, i) => {
                const realIndex = completedTasks.length - 1 - i;
                const isExpanded = expandedCompletedTaskId === i;
                const hitTarget = task.days_taken! <= (task.predicted_days || 999);
                
                return (
                  <li key={realIndex} className="p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm transition-all overflow-hidden">
                    <div 
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => setExpandedCompletedTaskId(isExpanded ? null : i)}
                    >
                      <div className="flex-1">
                        <span className="font-bold text-stone-200 text-base">{task.name}</span>
                        <div className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                          <span>Took {task.days_taken}d</span>
                          {task.predicted_days !== undefined && (
                            <span className={hitTarget ? "text-emerald-400/80" : "text-rose-400/80"}>
                              (Est: {task.predicted_days}d)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReopen(realIndex); }}
                        className="px-3 py-2 flex items-center gap-2 rounded-lg hover:bg-white/10 text-blue-400 transition-colors text-sm font-medium border border-transparent"
                        title="Reopen Task"
                      >
                        <RotateCcw size={16} /> Reopen
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/10 animate-in slide-in-from-top-2">
                        <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                          <div className="mb-4">
                            <div className="flex justify-between text-xs mb-2 font-medium">
                              <span className="text-stone-400">Actual: {task.days_taken}d</span>
                              <span className="text-stone-400">Target: {task.predicted_days ?? '?'}d</span>
                            </div>
                            <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${hitTarget ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                style={{ width: `${Math.min(100, (task.days_taken! / Math.max(task.predicted_days || 1, 1)) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {task.progress_log && task.progress_log.length > 0 && (
                            <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-3 mt-4">
                              {task.progress_log.map((log, logIdx) => (
                                <div key={logIdx} className="relative">
                                  <div className="absolute w-2 h-2 bg-violet-400 rounded-full -left-[21px] top-1.5 ring-4 ring-black/20"></div>
                                  <div className="bg-white/5 p-3 rounded-lg text-xs border border-white/5 shadow-sm">
                                    <span className="text-stone-400 block mb-1 font-mono">{log.date}</span>
                                    <span className="text-stone-200">{log.note}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
          </section>

        </div>
      </div>

      {/* Add Past Task Modal */}
      {showAddPastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-4 text-stone-100 font-heading">Add Past Task</h2>
            <p className="text-stone-400 text-sm mb-6">Enter a task you have already completed so the AI can learn your working speed.</p>
            
            <form onSubmit={handleAddPastTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-400 mb-1">Task Name</label>
                <input 
                  type="text" 
                  value={pastTaskName}
                  onChange={e => setPastTaskName(e.target.value)}
                  className="glass-input w-full p-3 rounded-xl"
                  placeholder="e.g., Database Migration"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-400 mb-1 flex justify-between">
                  <span>Complexity</span>
                  <span className="text-violet-300 font-bold">{pastTaskComplexity}/10</span>
                </label>
                <input 
                  type="range" 
                  min="1" max="10" 
                  value={pastTaskComplexity}
                  onChange={e => setPastTaskComplexity(parseInt(e.target.value))}
                  className="w-full accent-violet-500 h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-400 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={pastTaskStartDate}
                    onChange={e => setPastTaskStartDate(e.target.value)}
                    className="glass-input w-full p-3 rounded-xl text-stone-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-400 mb-1">Days Taken</label>
                  <input 
                    type="number" 
                    min="0"
                    value={pastTaskDays}
                    onChange={e => setPastTaskDays(Number.isNaN(e.target.valueAsNumber) ? '' : e.target.valueAsNumber)}
                    className="glass-input w-full p-3 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddPastModal(false)}
                  className="glass-button flex-1 py-3 rounded-xl font-medium text-stone-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingPast || !pastTaskName.trim() || pastTaskDays === ''}
                  className="cta-button glass-button flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50"
                >
                  {isSubmittingPast ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboarding Pop-up */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-background)] border border-[var(--color-primary)]/30 shadow-2xl p-8 max-w-lg w-full rounded-2xl animate-in zoom-in-95 duration-300 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
            <div className="bg-violet-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-violet-500/20">
              <BarChart3 size={36} className="text-violet-400" />
            </div>
            <h2 className="text-3xl font-extrabold mb-4 text-stone-100 font-heading">Welcome to TaskLedger AI!</h2>
            <p className="text-stone-300 text-lg mb-8 leading-relaxed">
              To get the most accurate AI predictions for your future tasks, the model needs to learn your working speed. 
              <br/><br/>
              Please add some tasks you've already completed in the past to seed the model.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setShowOnboarding(false);
                  setShowAddPastModal(true);
                }}
                className="cta-button glass-button w-full py-4 rounded-xl font-bold text-white text-lg"
              >
                + Add Past Tasks
              </button>
              <button 
                onClick={() => setShowOnboarding(false)}
                className="text-stone-400 hover:text-stone-200 text-sm py-2 font-medium transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
