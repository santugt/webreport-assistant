import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldAlert, Database, Settings, UploadCloud, Server, Loader2, CheckCircle, AlertCircle, FileText, PieChart, Lock, Unlock } from 'lucide-react';
import { RagConfig, UploadedDocument, UserLog } from '../types';
import { fetchUserLogs, getGlobalSetting, setGlobalSetting } from '../services/supabaseClient';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ragConfig: RagConfig;
  documents: UploadedDocument[];
  onConfigChange: (config: RagConfig) => void;
  onFileUpload: (file: File) => void;
  onClearCache: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  ragConfig,
  documents,
  onConfigChange,
  onFileUpload,
  onClearCache
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'danger'>('general');
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isSavingSetting, setIsSavingSetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUserLogs().then(logs => setUserLogs(logs));
      getGlobalSetting('maintenance_mode').then(val => setIsMaintenanceMode(val === true));
    }
  }, [isOpen]);

  const toggleMaintenanceMode = async () => {
    setIsSavingSetting(true);
    const newValue = !isMaintenanceMode;
    await setGlobalSetting('maintenance_mode', newValue);
    setIsMaintenanceMode(newValue);
    setIsSavingSetting(false);
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] ring-1 ring-white/10">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0">
          <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Admin Console
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

          {/* 0. USER AUDIT LOGS */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <PieChart className="w-3 h-3" /> User Access Logs
            </h3>
            <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs text-zinc-400">
                  <thead className="bg-zinc-900 sticky top-0 font-medium text-zinc-300">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {userLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-900/50">
                        <td className="p-3">{log.name || 'Unknown'}</td>
                        <td className="p-3 font-mono text-zinc-500">{log.email}</td>
                        <td className="p-3 text-zinc-600">{new Date(log.login_time).toLocaleString()}</td>
                      </tr>
                    ))}
                    {userLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center italic">No logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {activeTab === 'general' && (
            <div className="space-y-6">

              {/* Maintenance Mode Toggle */}
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    {isMaintenanceMode ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-zinc-200 font-medium">Application Lock</h4>
                    <p className="text-xs text-zinc-500">
                      {isMaintenanceMode
                        ? "Complete lockout active. Only admins can bypass."
                        : "Application is accessible to all engaged users."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleMaintenanceMode}
                  disabled={isSavingSetting}
                  className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                      ${isMaintenanceMode ? 'bg-amber-600' : 'bg-zinc-700'}
                      ${isSavingSetting ? 'opacity-50 cursor-wait' : ''}
                  `}
                >
                  <span
                    className={`${isMaintenanceMode ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Database className="w-3 h-3" /> Knowledge Base
                </h3>

                {/* Upload Area */}
                <div
                  onClick={triggerFileUpload}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group relative ${isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800/30'
                    }`}
                >
                  <div className={`p-2 rounded-full transition-colors ${isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 group-hover:bg-blue-500/20 group-hover:text-blue-400'
                    }`}>
                    <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-blue-400'}`} />
                  </div>
                  <span className={`text-xs font-medium transition-colors ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {isDragging ? 'Drop file to upload' : 'Click or Drag to Upload Source'}
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                {/* Document List */}
                <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Active Index ({documents.length})</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                    {documents.length === 0 && (
                      <div className="text-center py-4 text-xs text-zinc-600 italic">No documents indexed.</div>
                    )}
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800/50">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <span className="text-xs text-zinc-300 truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.status === 'chunking' || doc.status === 'embedding' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-blue-400 font-mono">{Math.round(doc.progress)}%</span>
                              <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                            </div>
                          ) : doc.status === 'ready' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline-block">
                            {(doc.content.length / 1024).toFixed(0)}KB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-px bg-zinc-800" />

              {/* 2. RAG SETTINGS */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Settings className="w-3 h-3" /> RAG Configuration
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 font-medium">Chunk Size</label>
                    <input
                      type="number"
                      value={ragConfig.chunkSize}
                      onChange={(e) => onConfigChange({ ...ragConfig, chunkSize: parseInt(e.target.value) || 1000 })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 font-medium">Overlap</label>
                    <input
                      type="number"
                      value={ragConfig.chunkOverlap}
                      onChange={(e) => onConfigChange({ ...ragConfig, chunkOverlap: parseInt(e.target.value) || 100 })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 font-medium">Top K (Context)</label>
                    <input
                      type="number"
                      value={ragConfig.topK}
                      onChange={(e) => onConfigChange({ ...ragConfig, topK: parseInt(e.target.value) || 5 })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded border border-zinc-800">
                  <div className="flex flex-col">
                    <span className="text-xs text-zinc-300 font-medium">Query Expansion</span>
                    <span className="text-[10px] text-zinc-600">Multi-query retrieval for better recall</span>
                  </div>
                  <button
                    onClick={() => onConfigChange({ ...ragConfig, enableQueryExpansion: !ragConfig.enableQueryExpansion })}
                    className={`w-10 h-5 rounded-full relative transition-colors ${ragConfig.enableQueryExpansion ? 'bg-blue-600' : 'bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${ragConfig.enableQueryExpansion ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-800" />

              {/* 3. DANGER ZONE */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert className="w-3 h-3 text-red-500" /> Danger Zone
                </h3>
                <button
                  onClick={() => {
                    if (window.confirm('WARNING: This will wipe all local data and reset the application state. Are you sure?')) {
                      onClearCache();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2"
```
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {userLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-900/50">
                        <td className="p-3">{log.name || 'Unknown'}</td>
                        <td className="p-3 font-mono text-zinc-500">{log.email}</td>
                        <td className="p-3 text-zinc-600">{new Date(log.login_time).toLocaleString()}</td>
                      </tr>
                    ))}
                    {userLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center italic">No logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800" />

          {
    activeTab === 'general' && (
      <div className="space-y-6">

        {/* Maintenance Mode Toggle */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
              {isMaintenanceMode ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-zinc-200 font-medium">Application Lock</h4>
              <p className="text-xs text-zinc-500">
                {isMaintenanceMode
                  ? "Complete lockout active. Only admins can bypass."
                  : "Application is accessible to all engaged users."}
              </p>
            </div>
          </div>
          <button
            onClick={toggleMaintenanceMode}
            disabled={isSavingSetting}
            className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                      ${isMaintenanceMode ? 'bg-amber-600' : 'bg-zinc-700'}
                      ${isSavingSetting ? 'opacity-50 cursor-wait' : ''}
                  `}
          >
            <span
              className={`${isMaintenanceMode ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Database className="w-3 h-3" /> Knowledge Base
          </h3>

          {/* Upload Area */}
          <div
            onClick={triggerFileUpload}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group relative ${isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800/30'
              }`}
          >
            <div className={`p-2 rounded-full transition-colors ${isDragging ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 group-hover:bg-blue-500/20 group-hover:text-blue-400'
              }`}>
              <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-blue-400'}`} />
            </div>
            <span className={`text-xs font-medium transition-colors ${isDragging ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
              {isDragging ? 'Drop file to upload' : 'Click or Drag to Upload Source'}
            </span>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Document List */}
          <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Active Index ({documents.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto p-2 space-y-2">
              {documents.length === 0 && (
                <div className="text-center py-4 text-xs text-zinc-600 italic">No documents indexed.</div>
              )}
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800/50">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="text-xs text-zinc-300 truncate max-w-[150px]" title={doc.name}>{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'chunking' || doc.status === 'embedding' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-blue-400 font-mono">{Math.round(doc.progress)}%</span>
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                      </div>
                    ) : doc.status === 'ready' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline-block">
                      {(doc.content.length / 1024).toFixed(0)}KB
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-zinc-800" />

        {/* 2. RAG SETTINGS */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Settings className="w-3 h-3" /> RAG Configuration
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Chunk Size</label>
              <input
                type="number"
                value={ragConfig.chunkSize}
                onChange={(e) => onConfigChange({ ...ragConfig, chunkSize: parseInt(e.target.value) || 1000 })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Overlap</label>
              <input
                type="number"
                value={ragConfig.chunkOverlap}
                onChange={(e) => onConfigChange({ ...ragConfig, chunkOverlap: parseInt(e.target.value) || 100 })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-medium">Top K (Context)</label>
              <input
                type="number"
                value={ragConfig.topK}
                onChange={(e) => onConfigChange({ ...ragConfig, topK: parseInt(e.target.value) || 5 })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-200 focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded border border-zinc-800">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-300 font-medium">Query Expansion</span>
              <span className="text-[10px] text-zinc-600">Multi-query retrieval for better recall</span>
            </div>
            <button
              onClick={() => onConfigChange({ ...ragConfig, enableQueryExpansion: !ragConfig.enableQueryExpansion })}
              className={`w-10 h-5 rounded-full relative transition-colors ${ragConfig.enableQueryExpansion ? 'bg-blue-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${ragConfig.enableQueryExpansion ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="h-px bg-zinc-800" />

        {/* 3. DANGER ZONE */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-3 h-3 text-red-500" /> Danger Zone
          </h3>
          <button
            onClick={() => {
              if (window.confirm('WARNING: This will wipe all local data and reset the application state. Are you sure?')) {
                onClearCache();
                onClose();
              }
            }}
            className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Database className="w-3 h-3" />
            Wipe Knowledge Base & Reset
          </button>
        </div>
      </div>
    )
  }

  {
    activeTab === 'logs' && (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <PieChart className="w-3 h-3" /> User Access Logs
          </h3>
          <span className="text-[10px] text-zinc-600">Last 50 logins</span>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-zinc-900 sticky top-0 font-medium text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {userLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-200">{log.name}</td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{log.email}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500 text-xs">
                      {new Date(log.login_time).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {userLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center italic">No logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
        </div >

  {/* Footer */ }
  < div className = "p-4 bg-zinc-950/30 border-t border-zinc-800 flex justify-end flex-shrink-0" >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-zinc-100 text-zinc-900 hover:bg-white rounded-md text-xs font-bold transition-colors shadow-lg shadow-zinc-900/20"
    >
      Save & Close
    </button>
          </div >
        </div >
      </div >
      );
};
```