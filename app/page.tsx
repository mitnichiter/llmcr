"use client";

import { useState, useRef, useEffect } from "react";
import { Send, UserPlus, RefreshCw, MessageSquare, Trash2, Wand2, Menu, X } from "lucide-react";

type Persona = {
  id: string;
  name: string;
  provider: "mistral" | "nvidia" | "openrouter";
  model_name: string;
  system_prompt: string;
  memory_md?: string;
};

type Message = {
  id: string;
  sender_name: string;
  content: string;
  isStream?: boolean;
};

export default function ChatRoom() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [activeAgent, setActiveAgent] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [chatMode, setChatMode] = useState<"human" | "ai">("human");
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({
    mistral: [],
    nvidia: [],
    openrouter: []
  });
  const [showSidebar, setShowSidebar] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const stopRequestedRef = useRef<boolean>(false);
  const isNearBottomRef = useRef<boolean>(true);
  const requestTimestampsRef = useRef<number[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [autoGenIdea, setAutoGenIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const scrollToBottom = () => {
    if (isNearBottomRef.current) {
      const behavior = status === "idle" ? "smooth" : "auto";
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, activeAgent]);

  const handleScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    isNearBottomRef.current = isNear;
  };

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const [mRes, nvRes, orRes] = await Promise.all([
          fetch('/api/models?provider=mistral'),
          fetch('/api/models?provider=nvidia'),
          fetch('/api/models?provider=openrouter')
        ]);
        const mData = await mRes.json();
        const nvData = await nvRes.json();
        const orData = await orRes.json();
        setAvailableModels({
          mistral: mData.models || [],
          nvidia: nvData.models || [],
          openrouter: orData.models || []
        });
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    const loadInitialSession = async () => {
      try {
        const res = await fetch('/api/session/global');
        const data = await res.json();
        if (res.ok && data.sessionId) {
          setSessionId(data.sessionId);
          setPersonas(data.personas || []);
          setMessages(data.messages || []);
        }
      } catch (e) {
        console.error("Failed to load global session", e);
      }
    };
    loadInitialSession();
  }, []);

  useEffect(() => {
    const pollMessages = async () => {
      if (status !== 'idle' || mockMode) return;
      try {
        const res = await fetch('/api/session/global');
        const data = await res.json();
        if (res.ok && data.messages) {
          setMessages(prev => {
            if (!data.messages) return prev;
            if (data.messages.length !== prev.length) return data.messages;
            return prev;
          });
        }
      } catch (e) {}
    };

    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [status, mockMode]);

  const addPersona = () => {
    setPersonas([
      ...personas,
      {
        id: crypto.randomUUID(),
        name: `Agent ${personas.length + 1}`,
        provider: "mistral",
        model_name: availableModels.mistral.includes("mistral-medium-latest") ? "mistral-medium-latest" : (availableModels.mistral[0] || "mistral-medium-latest"),
        system_prompt: "You are a helpful assistant.",
        memory_md: "",
      },
    ]);
  };

  const removePersona = async (idToRemove: string) => {
    setPersonas(personas.filter(p => p.id !== idToRemove));
    if (!mockMode && sessionId) {
      try {
        await fetch(`/api/session/${sessionId}/personas?personaId=${idToRemove}`, { method: 'DELETE' });
      } catch (e) {
        console.error("Failed to delete persona from DB", e);
      }
    }
  };

  const generateScenario = async () => {
    if (!autoGenIdea.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: autoGenIdea })
      });
      const data = await res.json();
      
      if (res.ok && data.personas && Array.isArray(data.personas)) {
        const newPersonas = data.personas.map((p: any) => ({
          id: crypto.randomUUID(),
          name: p.name || "Generated Agent",
          provider: "mistral" as const,
          model_name: availableModels.mistral.includes("mistral-medium-latest") ? "mistral-medium-latest" : (availableModels.mistral[0] || "mistral-medium-latest"),
          system_prompt: p.system_prompt || "",
          memory_md: "",
        }));
        const updatedPersonas = [...personas, ...newPersonas];
        setPersonas(updatedPersonas);
        setAutoGenIdea("");
        if (!mockMode && sessionId) {
          try {
            await fetch(`/api/session/${sessionId}/personas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatedPersonas),
            });
          } catch(e) {}
        }
      } else {
        alert("Generation Error: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Network Error: " + String(e));
    } finally {
      setIsGenerating(false);
    }
  };

  const savePersonas = async () => {
    if (!sessionId) return;
    if (mockMode) {
      alert("Personas saved to local state (Mock Mode).");
      return;
    }
    try {
      const res = await fetch(`/api/session/${sessionId}/personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personas),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Personas saved to DB!");
      } else {
        alert("Database Error: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Network Error: " + String(e));
    }
  };

  const resetChat = async () => {
    if (!sessionId) return;
    if (!confirm("Are you sure you want to clear the entire chat history for everyone?")) return;
    
    setMessages([]);
    setStatus("idle");
    setActiveAgent("");
    stopRequestedRef.current = true;
    
    if (mockMode) return;
    
    try {
      const res = await fetch(`/api/session/${sessionId}/reset`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert("Failed to clear chat: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("Network Error: " + String(e));
    }
  };

  const sendMessage = async (isIcebreaker = false, isAutoContinue = false) => {
    if (!sessionId) return;
    if (!isIcebreaker && !isAutoContinue && !input.trim()) return;
    
    let userMsg: Message | null = null;
    
    if (!isIcebreaker && !isAutoContinue) {
      userMsg = {
        id: crypto.randomUUID(),
        sender_name: "User",
        content: input,
      };
      setMessages((prev) => [...prev, userMsg!]);
      setInput("");
    }
    
    setStatus("evaluating");
    let currentAgentName = "";

    const handleRetry = () => {
      const realMessages = messagesRef.current.filter(m => m.id !== 'retry-placeholder');
      const lastRealMsgId = realMessages.length > 0 ? realMessages[realMessages.length - 1].id : null;
      const retryPlaceholderId = 'retry-placeholder';
      
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== retryPlaceholderId);
        return [...filtered, {
          id: retryPlaceholderId,
          sender_name: 'System',
          content: '[resting... retrying in 5s]'
        }];
      });
      
      setStatus("typing");
      setActiveAgent("System");

      setTimeout(() => {
        const currentRealMessages = messagesRef.current.filter(m => m.id !== retryPlaceholderId);
        const currentLastRealMsgId = currentRealMessages.length > 0 ? currentRealMessages[currentRealMessages.length - 1].id : null;
        
        if (currentLastRealMsgId !== lastRealMsgId) {
          setMessages(prev => prev.filter(m => m.id !== retryPlaceholderId));
          setStatus("idle");
          setActiveAgent("");
          return;
        }
        
        setMessages(prev => prev.filter(m => m.id !== retryPlaceholderId));
        sendMessage(false, true);
      }, 5000);
    };

    if (mockMode) {
      setTimeout(() => {
        setStatus("typing");
        const mockAgent = personas.length > 0 ? personas[Math.floor(Math.random() * personas.length)] : { name: "Mock Agent" };
        setActiveAgent(mockAgent.name);
        currentAgentName = mockAgent.name;
        
        const streamMsgId = crypto.randomUUID();
        const chunks = ["Hello! ", "This ", "is ", "a ", "simulated ", "response ", "in ", "Mock ", "Mode."];
        let i = 0;
        let currentMsg = "";
        
        const interval = setInterval(() => {
          if (i < chunks.length) {
            currentMsg += chunks[i];
            setMessages((prev) => {
               const newArr = [...prev];
               const existingIdx = newArr.findIndex(m => m.id === streamMsgId);
               if (existingIdx > -1) {
                 newArr[existingIdx].content = currentMsg;
               } else {
                 newArr.push({ id: streamMsgId, sender_name: mockAgent.name, content: currentMsg, isStream: true });
               }
               return newArr;
            });
            i++;
          } else {
            clearInterval(interval);
            setStatus("idle");
            setActiveAgent("");
            if (!stopRequestedRef.current) {
              setTimeout(() => sendMessage(false, true), 1500);
            }
          }
        }, 200);
      }, 1000);
      return;
    }

    try {
      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: isIcebreaker ? "SYSTEM_ICEBREAKER" : (isAutoContinue ? "" : userMsg?.content),
          isIcebreaker,
          mode: chatMode
        }),
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const streamMsgId = crypto.randomUUID();
      
      let currentMsg = "";
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: evaluating")) {
            setStatus("evaluating");
          } else if (line.startsWith("data: error")) {
            hasError = true;
            setStatus("idle");
            setActiveAgent("");
          } else if (line.startsWith("data: typing")) {
            setStatus("typing");
          } else if (line.startsWith("data: idle")) {
            setStatus("idle");
            setActiveAgent("");
          } else if (line.startsWith("data: {\"id\":")) {
             try {
                const agent = JSON.parse(line.slice(5).trim());
                currentAgentName = agent.name;
                setActiveAgent(agent.name);
             } catch(e) {}
          } else if (line.startsWith("data: {\"chunk\":")) {
             try {
               const data = JSON.parse(line.slice(5).trim());
               currentMsg += data.chunk || "";
               setMessages((prev) => {
                 const newArr = [...prev];
                 const existingIdx = newArr.findIndex(m => m.id === streamMsgId);
                 if (existingIdx > -1) {
                   newArr[existingIdx].content = currentMsg;
                 } else {
                   newArr.push({ id: streamMsgId, sender_name: activeAgent || currentAgentName || 'Agent', content: currentMsg, isStream: true });
                 }
                 return newArr;
               });
             } catch(e) {}
          } else if (line.startsWith("{\"error\"")) {
             try {
               const err = JSON.parse(line).error;
               alert("Server Error: " + err);
               hasError = true;
             } catch(e) {}
             setStatus("idle");
             setActiveAgent("");
          }
        }
      }

      if (hasError && !stopRequestedRef.current) {
        handleRetry();
      } else if (!hasError && currentMsg.trim().length > 0 && !stopRequestedRef.current) {
        const now = Date.now();
        requestTimestampsRef.current = requestTimestampsRef.current.filter(t => now - t < 60000);
        
        let delay = Math.max(1500, Math.min(3500, currentMsg.length * 15));
        
        if (requestTimestampsRef.current.length >= 4) {
          delay = 13000;
        }
        
        requestTimestampsRef.current.push(now);

        setTimeout(() => {
          if (!stopRequestedRef.current) {
            sendMessage(false, true);
          } else {
            setStatus("idle");
            setActiveAgent("");
          }
        }, delay);
      } else {
        setStatus("idle");
        setActiveAgent("");
      }

      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
      }

    } catch (e) {
      console.error(e);
      handleRetry();
    }
  };

  if (!sessionId) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center font-sans text-slate-900">
         <div className="flex flex-col items-center gap-4">
           <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
           <p className="text-slate-500">Connecting to Global Room...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 relative">
      {/* Mobile Sidebar Backdrop Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity" 
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar: Configuration */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg transition-transform duration-300 transform
        md:relative md:translate-x-0 md:shadow-none
        ${showSidebar ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Global LLMCR
            </h1>
            <button 
              onClick={() => setShowSidebar(false)} 
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-2 flex justify-between items-center">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={mockMode} onChange={e => setMockMode(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
              Mock DB
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={chatMode === 'ai'} onChange={e => setChatMode(e.target.checked ? 'ai' : 'human')} className="rounded text-indigo-600 focus:ring-indigo-500" />
              Rant Mode (AI)
            </label>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Personas</h2>
                <button onClick={addPersona} title="Add Manual Agent" className="text-indigo-600 hover:text-indigo-800 p-1">
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Scenario Generator */}
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
                <p className="text-xs font-semibold text-slate-600 mb-2">Scenario Creator</p>
                <input
                  type="text"
                  className="w-full text-xs border border-slate-300 rounded p-1.5 mb-2 bg-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. 3 cunning GenZ agents gossiping..."
                  value={autoGenIdea}
                  onChange={e => setAutoGenIdea(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateScenario()}
                />
                <button
                  onClick={generateScenario}
                  disabled={isGenerating || !autoGenIdea.trim()}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-50 text-xs font-medium py-1.5 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                >
                  {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {isGenerating ? 'Generating Scenario...' : 'Auto-Create Agents'}
                </button>
              </div>
              
              <div className="space-y-4">
                {personas.map((p, i) => (
                  <div key={p.id} className="p-3 border border-slate-200 rounded-md bg-slate-50 shadow-sm relative group">
                    <button
                      onClick={() => removePersona(p.id)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                      title="Remove Agent"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <input 
                      className="w-10/12 text-sm font-semibold bg-transparent border-b border-slate-300 pb-1 mb-2 focus:outline-none focus:border-indigo-500" 
                      value={p.name}
                      onChange={e => {
                        const newP = [...personas];
                        newP[i].name = e.target.value;
                        setPersonas(newP);
                      }}
                      placeholder="Agent Name"
                    />
                    
                    <div className="relative mb-2">
                      <select 
                        className="w-full text-xs border border-slate-300 rounded p-1 bg-white appearance-none pr-6 mb-2"
                        value={p.provider}
                        onChange={e => {
                          const newP = [...personas];
                          const newProvider = e.target.value as "mistral" | "nvidia" | "openrouter";
                          newP[i].provider = newProvider;
                          if (availableModels[newProvider] && availableModels[newProvider].length > 0) {
                            newP[i].model_name = availableModels[newProvider][0];
                          } else {
                            newP[i].model_name = "";
                          }
                          setPersonas(newP);
                        }}
                      >
                        <option value="mistral">Mistral API</option>
                        <option value="nvidia">NVIDIA NIM</option>
                        <option value="openrouter">OpenRouter (Free)</option>
                      </select>
                      <div className="pointer-events-none absolute top-0.5 right-0 flex items-center px-1 text-slate-500">
                        <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>

                    <div className="relative mb-2">
                      <select 
                        className="w-full text-xs border border-slate-300 rounded p-1 bg-white appearance-none pr-6"
                        value={p.model_name}
                        onChange={e => {
                          const newP = [...personas];
                          newP[i].model_name = e.target.value;
                          setPersonas(newP);
                        }}
                      >
                        <option value="" disabled>Select a model...</option>
                        {(availableModels[p.provider] || []).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                        <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>

                    <textarea 
                      className="w-full text-xs border border-slate-300 rounded p-1 h-20 bg-white resize-none"
                      value={p.system_prompt}
                      onChange={e => {
                        const newP = [...personas];
                        newP[i].system_prompt = e.target.value;
                        setPersonas(newP);
                      }}
                      placeholder="System Prompt"
                    />
                  </div>
                ))}
                
                {personas.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={savePersonas}
                      className="flex-1 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      Save Personas
                    </button>
                    {status === 'idle' ? (
                      <button 
                        onClick={() => sendMessage(true, false)}
                        disabled={status !== 'idle'}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                        title="Pick a random agent to introduce themselves"
                      >
                        Start Icebreaker
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          stopRequestedRef.current = true;
                          setStatus("idle");
                          setActiveAgent("");
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                        title="Stop the agents from talking"
                      >
                        Stop Chat
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white w-full">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSidebar(true)} 
              className="md:hidden p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Open Settings"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Live Discussion</h2>
          </div>
          <button 
            onClick={resetChat} 
            disabled={!sessionId}
            className="text-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md"
          >
            <Trash2 className="w-4 h-4" /> Reset Chat
          </button>
        </div>
        
        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-center text-sm">No messages yet. Configure agents and say hi!</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender_name === 'User' ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_name}</span>
                <div className={`px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[80%] whitespace-pre-wrap shadow-sm text-sm md:text-base ${
                  msg.sender_name === 'User' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {status !== 'idle' && (
            <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 bg-slate-50 w-fit px-4 py-2 rounded-full border border-slate-200">
              {status === 'evaluating' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" /> 
                  Agents evaluating context...
                </>
              )}
              {status === 'typing' && (
                <>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "0ms"}}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "150ms"}}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: "300ms"}}></span>
                  </span>
                  {activeAgent ? `${activeAgent} is typing...` : 'Agent typing...'}
                </>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="max-w-4xl mx-auto flex items-end gap-2">
            <textarea
              className="flex-1 border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-[52px] min-h-[52px] max-h-32 text-sm shadow-sm bg-white"
              placeholder={sessionId ? "Message the group..." : "Start a session first..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!sessionId}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (status !== 'idle') {
                    stopRequestedRef.current = true;
                    setStatus("idle");
                    setActiveAgent("");
                    setTimeout(() => sendMessage(false, false), 100);
                  } else {
                    sendMessage(false, false);
                  }
                }
              }}
            />
            {status === 'idle' ? (
              <button
                onClick={() => sendMessage(false, false)}
                disabled={!sessionId || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  stopRequestedRef.current = true;
                  setStatus("idle");
                  setActiveAgent("");
                }}
                className="bg-red-500 hover:bg-red-600 text-white p-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center"
                title="Stop conversation"
              >
                <div className="w-5 h-5 bg-white rounded-sm" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
