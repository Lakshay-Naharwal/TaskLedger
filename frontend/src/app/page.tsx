'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  addTask,
  completeTask,
  generateReport as generateProductivityReport,
  getTasks,
  logProgress,
  predictDuration,
  reopenTask,
  Task,
  ReportData
} from '../lib/store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Plus, CheckCircle2, ListTodo, Activity, RotateCcw, 
  MessageSquarePlus, BarChart3, Clock, LayoutDashboard
} from 'lucide-react';

export default function Dashboard() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskComplexity, setNewTaskComplexity] = useState<number>(5);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [expandedCompletedTaskId, setExpandedCompletedTaskId] = useState<number | null>(null);
  const [newLogNote, setNewLogNote] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasks();
      setActiveTasks(data.active);
      setCompletedTasks(data.completed);
    } catch (err) {
      console.error("Task API failed", err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    setPrediction(null);
  }, [newTaskComplexity]);

  const isDuplicate = activeTasks.some(t => t.name.toLowerCase() === newTaskName.trim().toLowerCase());

  const handlePredict = async () => {
    if (!newTaskName.trim()) return;
    setIsPredicting(true);
    try {
      const data = await predictDuration(newTaskComplexity);
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
      await addTask(newTaskName, newTaskComplexity);
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
      await logProgress(activeTasks[index].name, newLogNote.trim());
      await loadTasks();
      setNewLogNote('');
    } catch (err) {
      console.error("Log progress failed", err);
    }
  };

  const handleCompleteTask = async (index: number) => {
    try {
      await completeTask(activeTasks[index].name);
      await loadTasks();
    } catch (err) {
      console.error("Complete task failed", err);
    }
  };

  const handleReopen = async (realIndex: number) => {
    try {
      await reopenTask(completedTasks[realIndex].name);
      await loadTasks();
    } catch (err) {
      console.error("Reopen task failed", err);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const data = await generateProductivityReport(completedTasks);
      setReportData(data);
    } catch (err) {
      console.error("Report API failed", err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="text-center space-y-4 pt-10 pb-6 flex flex-col items-center">
        <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-400/20 shadow-[0_0_30px_rgba(59,130,246,0.3)] mb-2">
          <LayoutDashboard size={40} className="text-blue-400" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg text-white">
          TaskLedger <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">AI</span>
        </h1>
        <p className="text-xl text-slate-300 font-light max-w-2xl mx-auto">
          Manage your tasks and use Machine Learning to predict how long they will take.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-8">
          {/* Add Task Panel */}
          <section className="glass-panel p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
              <Plus className="text-blue-400" /> New Task
            </h2>
            <form onSubmit={handleAddTask} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Task Name</label>
                <input 
                  type="text" 
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className={`glass-input w-full p-4 rounded-xl text-lg ${isDuplicate ? 'border-red-500/50' : ''}`}
                  placeholder="e.g., Optimize Database Queries"
                  required
                />
                {isDuplicate && (
                  <p className="text-red-400 text-xs mt-2 font-medium">Task already exists.</p>
                )}
              </div>
              
              <div className={`space-y-6 transition-all duration-300 overflow-hidden ${newTaskName.trim().length > 0 ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-4 flex justify-between">
                    <span>Complexity Score</span>
                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                      {newTaskComplexity} / 10
                    </span>
                  </label>
                  <input 
                    type="range" 
                    min="1" max="10" 
                    value={newTaskComplexity}
                    onChange={e => setNewTaskComplexity(parseInt(e.target.value))}
                    className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <button 
                    type="button" 
                    onClick={handlePredict}
                    disabled={isPredicting || isDuplicate}
                    className="glass-button flex-1 py-4 rounded-xl font-bold text-white/90 text-sm flex items-center justify-center gap-2"
                  >
                    <Activity size={18} />
                    {isPredicting && prediction === null ? 'Thinking...' : (prediction !== null ? `Est: ~${prediction} Days` : 'Predict Duration')}
                  </button>
                  <button 
                    type="submit" 
                    disabled={isDuplicate || isPredicting}
                    className="glass-button flex-1 py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(59, 130, 246, 0.9))' }}
                  >
                    <Plus size={20} /> Create Task
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Active Tasks Panel */}
          <section className="glass-panel p-8 flex flex-col min-h-[400px]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
              <ListTodo className="text-blue-400" /> Active Tasks
              <span className="ml-auto bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full">{activeTasks.length}</span>
            </h2>
            
            {activeTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 py-10">
                <CheckCircle2 size={48} className="mb-4" />
                <p>You are all caught up!</p>
              </div>
            ) : (
              <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {activeTasks.map((task, i) => (
                  <li key={i} className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-lg text-white mb-1">{task.name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span className="bg-black/30 px-2 py-1 rounded">C:{task.complexity}</span>
                          <span className="flex items-center gap-1"><Clock size={12}/> {task.start_date}</span>
                          {task.predicted_days !== undefined && (
                            <span className="text-blue-300 font-medium bg-blue-900/20 px-2 py-1 rounded">
                              ~{task.predicted_days}d
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button 
                          onClick={() => setExpandedTaskId(expandedTaskId === i ? null : i)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                          title="Progress Logs"
                        >
                          <MessageSquarePlus size={18} />
                        </button>
                        <button 
                          onClick={() => handleCompleteTask(i)}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors border border-green-500/20"
                          title="Complete Task"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {expandedTaskId === i && (
                      <div className="mt-5 pt-5 border-t border-white/5 animate-in slide-in-from-top-2">
                        {task.progress_log && task.progress_log.length > 0 ? (
                          <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-2">
                            {task.progress_log.map((log, logIdx) => (
                              <div key={logIdx} className="bg-black/40 p-3 rounded-lg border border-white/5 flex gap-3 text-sm">
                                <span className="text-blue-400 font-mono text-xs whitespace-nowrap mt-0.5">{log.date.slice(5)}</span>
                                <span className="text-slate-200">{log.note}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic mb-4">No logs yet.</p>
                        )}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newLogNote}
                            onChange={e => setNewLogNote(e.target.value)}
                            className="glass-input flex-1 p-3 rounded-lg text-sm"
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
               <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                <BarChart3 className="text-purple-400" /> AI Insights
               </h2>
               {reportData && (
                 <button 
                   onClick={generateReport}
                   disabled={isGeneratingReport}
                   className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                 >
                   Refresh
                 </button>
               )}
             </div>
            
            {reportData ? (
              <div className="space-y-8 animate-in fade-in duration-700">
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Avg Days by Complexity</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.complexity_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="complexity" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(255,255,255,0.05)'}}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="days_taken" radius={[4, 4, 0, 0]}>
                          {reportData.complexity_data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="url(#colorUv)" />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Completion by Day</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.day_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v.slice(0,3)} />
                        <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(255,255,255,0.05)'}}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <BarChart3 size={48} className="text-slate-600 mb-4 opacity-50" />
                <p className="text-slate-400 max-w-xs mb-6">Need at least 3 completed tasks to generate AI productivity charts.</p>
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
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
              <CheckCircle2 className="text-green-400" /> Completed
              <span className="ml-auto bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-3 py-1 rounded-full">
                {completedTasks.length}
              </span>
            </h2>
            <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {completedTasks.slice().reverse().map((task, i) => {
                const realIndex = completedTasks.length - 1 - i;
                const isExpanded = expandedCompletedTaskId === i;
                const hitTarget = task.days_taken! <= (task.predicted_days || 999);
                
                return (
                  <li key={realIndex} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all overflow-hidden">
                    <div 
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => setExpandedCompletedTaskId(isExpanded ? null : i)}
                    >
                      <div className="flex-1">
                        <span className="font-bold text-white text-base">{task.name}</span>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>Took {task.days_taken}d</span>
                          {task.predicted_days !== undefined && (
                            <span className={hitTarget ? "text-green-400/80" : "text-orange-400/80"}>
                              (Est: {task.predicted_days}d)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleReopen(realIndex); }}
                        className="p-2 rounded-lg hover:bg-white/10 text-blue-300 transition-colors"
                        title="Reopen Task"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2">
                        <div className="bg-black/30 rounded-xl p-5 border border-white/5">
                          <div className="mb-4">
                            <div className="flex justify-between text-xs mb-2">
                              <span className="text-slate-400">Actual: {task.days_taken}d</span>
                              <span className="text-slate-400">Target: {task.predicted_days ?? '?'}d</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${hitTarget ? 'bg-green-500' : 'bg-orange-500'}`} 
                                style={{ width: `${Math.min(100, (task.days_taken! / Math.max(task.predicted_days || 1, 1)) * 100)}%` }}
                              />
                            </div>
                          </div>

                          {task.progress_log && task.progress_log.length > 0 && (
                            <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-3 mt-4">
                              {task.progress_log.map((log, logIdx) => (
                                <div key={logIdx} className="relative">
                                  <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[21px] top-1.5 ring-4 ring-black"></div>
                                  <div className="bg-white/5 p-3 rounded-lg text-xs">
                                    <span className="text-blue-300 block mb-1 font-mono">{log.date}</span>
                                    <span className="text-slate-200">{log.note}</span>
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
          </section>

        </div>
      </div>
    </main>
  );
}
