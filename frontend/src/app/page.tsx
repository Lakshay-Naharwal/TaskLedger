/* eslint-disable @next/next/no-img-element */
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
} from '../lib/store';

export default function Dashboard() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskComplexity, setNewTaskComplexity] = useState<number>(5);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  
  const [reportImg, setReportImg] = useState<string | null>(null);
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
      alert("Could not connect to the Python backend.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTasks();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTasks]);

  // Reset prediction if complexity changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPrediction(null);
    }, 0);
    return () => clearTimeout(timer);
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
      alert("Could not get a prediction from the Python backend.");
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
    } catch (err) {
      console.error("Add task API failed", err);
      alert("Could not add the task in the Python backend.");
      return;
    }

    setNewTaskName('');
    setNewTaskComplexity(5);
    setPrediction(null);
  };

  const handleAddLog = async (index: number) => {
    if (!newLogNote.trim()) return;

    try {
      await logProgress(activeTasks[index].name, newLogNote.trim());
      await loadTasks();
    } catch (err) {
      console.error("Log progress API failed", err);
      alert("Could not save the progress log in the Python backend.");
      return;
    }

    setNewLogNote('');
  };

  const handleCompleteTask = async (index: number) => {
    try {
      await completeTask(activeTasks[index].name);
      await loadTasks();
    } catch (err) {
      console.error("Complete task API failed", err);
      alert("Could not complete the task in the Python backend.");
    }
  };

  const handleReopen = async (realIndex: number) => {
    try {
      await reopenTask(completedTasks[realIndex].name);
      await loadTasks();
    } catch (err) {
      console.error("Reopen task API failed", err);
      alert("Could not reopen the task in the Python backend.");
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const data = await generateProductivityReport(completedTasks);
      setReportImg(`data:image/png;base64,${data.image_base64}`);
    } catch (err) {
      console.error("Report API failed", err);
      alert("Could not connect to the AI Backend.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="text-center space-y-4 pt-10 pb-6">
        <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-lg">
          TaskLedger <span className="text-blue-400">AI</span>
        </h1>
        <p className="text-xl text-blue-200/80 font-light max-w-2xl mx-auto">
          Manage your tasks and use Machine Learning to predict how long they will take.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          
          {/* Add Task Panel */}
          <section className="glass-panel p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">✨</span> New Task
            </h2>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label htmlFor="taskName" className="block text-sm font-medium text-blue-100/70 mb-1">Task Name</label>
                <input 
                  id="taskName"
                  type="text" 
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  className={`glass-input w-full p-3 rounded-lg ${isDuplicate ? 'border-red-500/50 focus:border-red-500/50' : ''}`}
                  placeholder="e.g., Optimize Database Queries"
                  required
                />
                {isDuplicate && (
                  <p className="text-red-400 text-xs mt-2 font-medium">A task with this name already exists.</p>
                )}
              </div>
              
              {newTaskName.trim().length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div>
                    <label htmlFor="taskComplexity" className="block text-sm font-medium text-blue-100/70 mb-1">
                      Complexity (1-10): <span className="font-bold text-white">{newTaskComplexity}</span>
                    </label>
                    <input 
                      id="taskComplexity"
                      type="range" 
                      min="1" max="10" 
                      value={newTaskComplexity}
                      onChange={e => setNewTaskComplexity(parseInt(e.target.value))}
                      className="w-full accent-blue-400"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button" 
                      onClick={handlePredict}
                      disabled={isPredicting || isDuplicate}
                      className="glass-button flex-1 py-3 rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    >
                      {isPredicting && prediction === null ? '🤖 Thinking...' : (prediction !== null ? `🤖 Est: ~${prediction} Days` : 'Predict Estimate')}
                    </button>
                    <button 
                      type="submit" 
                      disabled={isDuplicate || isPredicting}
                      className="glass-button flex-1 py-3 rounded-lg font-bold text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isPredicting && prediction === null ? 'Predicting...' : 'Add Task'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </section>

          {/* Active Tasks Panel */}
          <section className="glass-panel p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🔥</span> Active Tasks
            </h2>
            {activeTasks.length === 0 ? (
              <p className="text-white/50 text-center py-4">No active tasks. Add one above!</p>
            ) : (
              <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {activeTasks.map((task, i) => (
                  <li key={i} className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-lg">{task.name}</p>
                        <p className="text-xs text-white/60">
                          Complexity: {task.complexity} • Started: {task.start_date}
                          {task.predicted_days !== undefined && (
                            <span className="text-blue-300 font-medium"> • Est: ~{task.predicted_days} Days</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setExpandedTaskId(expandedTaskId === i ? null : i)}
                          className="glass-button px-3 py-1.5 rounded text-xs font-medium"
                        >
                          {expandedTaskId === i ? 'Hide Logs' : 'Logs'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleCompleteTask(i)}
                          className="glass-button px-3 py-1.5 rounded text-xs font-medium bg-green-900/30 border-green-500/30 hover:bg-green-800/40"
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                    
                    {expandedTaskId === i && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-in fade-in duration-200">
                        {task.progress_log && task.progress_log.length > 0 ? (
                          <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
                            {task.progress_log.map((log, logIdx) => (
                              <li key={logIdx} className="text-sm bg-black/20 p-2 rounded border border-white/5">
                                <span className="text-blue-300 text-xs mr-2 font-mono">{log.date}</span>
                                <span className="text-white/90">{log.note}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-white/50 italic text-center py-2">No progress logs yet.</p>
                        )}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newLogNote}
                            onChange={e => setNewLogNote(e.target.value)}
                            className="glass-input flex-1 p-2 rounded text-sm"
                            placeholder="Add a progress note..."
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddLog(i);
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => handleAddLog(i)}
                            className="glass-button px-3 py-1.5 rounded text-sm font-medium"
                          >
                            Add
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
          <section className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px]">
             <h2 className="text-2xl font-bold mb-4 w-full text-left flex items-center gap-2">
              <span className="text-2xl">📈</span> Productivity Report
            </h2>
            
            {reportImg ? (
              <img src={reportImg} alt="Productivity Report" className="w-full rounded-lg shadow-2xl" />
            ) : (
              <div className="text-center space-y-4 py-8">
                <p className="text-white/60">Generate a chart to view your performance across {completedTasks.length} completed tasks.</p>
                <button 
                  onClick={generateReport}
                  disabled={isGeneratingReport || completedTasks.length < 3}
                  className="glass-button px-6 py-3 rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                </button>
                {completedTasks.length < 3 && <p className="text-xs text-red-300 mt-2">Need at least 3 completed tasks to generate report.</p>}
              </div>
            )}
            
            {reportImg && (
              <button 
                onClick={generateReport}
                disabled={isGeneratingReport}
                className="mt-6 glass-button px-6 py-2 rounded-lg text-sm font-medium"
              >
                 {isGeneratingReport ? 'Refreshing...' : 'Refresh Report'}
              </button>
            )}
          </section>

          {/* Completed Tasks Panel */}
          <section className="glass-panel p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">✅</span> Completed Tasks ({completedTasks.length})
            </h2>
            <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {completedTasks.slice().reverse().map((task, i) => {
                const realIndex = completedTasks.length - 1 - i;
                return (
                  <li key={realIndex} className="p-3 rounded-lg bg-green-900/20 border border-green-500/20 flex flex-col hover:bg-green-900/30 transition-colors text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{task.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/70 mr-2">{task.days_taken} days</span>
                        <button 
                          onClick={() => setExpandedCompletedTaskId(expandedCompletedTaskId === i ? null : i)}
                          className="glass-button px-2 py-1 rounded text-xs opacity-70 hover:opacity-100"
                        >
                          {expandedCompletedTaskId === i ? 'Hide Report' : 'Report'}
                        </button>
                        <button 
                          onClick={() => handleReopen(realIndex)}
                          className="glass-button px-2 py-1 rounded text-xs opacity-70 hover:opacity-100 flex items-center gap-1 text-blue-300"
                          title="Move back to Active Tasks"
                        >
                          <span>↩️</span> Reopen
                        </button>
                      </div>
                    </div>
                    
                    {expandedCompletedTaskId === i && (
                      <div className="mt-3 pt-4 border-t border-green-500/20 animate-in fade-in duration-200">
                        
                        {/* Task Analysis Dashboard */}
                        <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-4">
                          <h4 className="text-blue-300 font-bold text-xs uppercase tracking-wider mb-2">📊 Task Analysis Report</h4>
                          
                          {/* Metrics Row */}
                          <div className="grid grid-cols-1 gap-4">
                            {/* Estimation vs Reality */}
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-[10px] text-white/50 uppercase mb-1">Time to Complete</p>
                              <div className="flex items-end gap-2 mb-2">
                                <span className="text-2xl font-bold">{task.days_taken} <span className="text-sm font-normal text-white/50">days</span></span>
                              </div>
                              
                              {task.predicted_days !== undefined ? (
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-white/60">Vs Estimate (~{task.predicted_days}d)</span>
                                    {task.days_taken! <= task.predicted_days! ? (
                                      <span className="text-green-400 font-bold">Ahead</span>
                                    ) : (
                                      <span className="text-orange-400 font-bold">Overdue</span>
                                    )}
                                  </div>
                                  <div className="w-full bg-white/10 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${task.days_taken! <= task.predicted_days! ? 'bg-green-400' : 'bg-orange-400'}`} 
                                      style={{ width: `${Math.min(100, (task.days_taken! / Math.max(task.predicted_days!, 1)) * 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-white/40 italic">No AI prediction was made.</p>
                              )}
                            </div>
                          </div>

                          {/* Progress Logs Timeline */}
                          {task.progress_log && task.progress_log.length > 0 ? (
                            <div className="mt-4 pt-2 border-t border-white/5">
                              <p className="text-[10px] text-white/50 uppercase mb-3">Activity Logs</p>
                              <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-3 py-1">
                                {task.progress_log.map((log, logIdx) => (
                                  <div key={logIdx} className="relative">
                                    <div className="absolute w-2 h-2 bg-blue-400 rounded-full -left-[21px] top-1.5"></div>
                                    <div className="bg-white/5 p-2 rounded text-xs border border-white/5">
                                      <span className="text-blue-300 mr-2 font-mono">{log.date}</span>
                                      <span className="text-white/80">{log.note}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 pt-2 border-t border-white/5">
                              <p className="text-xs text-white/40 italic text-center pt-2">No progress logs recorded for this task.</p>
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
