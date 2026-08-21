import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dbAdapter } from '../../lib/dbAdapter';
import { askGemini, executeTool, type ChatMessage } from '../../services/aiService';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  name: string;
  role: string;
  schoolId: string;
  schoolName?: string;
}

const allowedRoles = new Set(['schooladmin', 'registrar']);

export const AIAgentWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'model'; text: string; timestamp: Date }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNewResponse, setHasNewResponse] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; name: string; args: any; engine: string } | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch profile when authenticated
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setProfileLoading(false);
      setMessages([]);
      setChatHistory([]);
      return;
    }

    let alive = true;
    setProfileLoading(true);
    setProfile(null);
    setMessages([]);
    setChatHistory([]);

    const fetchProfile = async () => {
      try {
        const res = await dbAdapter.getDoc(`users/${currentUser.uid}`);
        if (!alive) return;
        if (res.exists) {
          const userData = res.data as UserProfile;
          if (!allowedRoles.has(userData.role)) {
            setProfileLoading(false);
            return;
          }

          setProfile(userData);
          
          // Initial greeting based on role
          const roleGreetings: Record<string, string> = {
            schooladmin: `Welcome, Principal/Admin ${userData.name}. I am your School Operations Copilot. How can I help you manage teachers, schedule terms, or check configurations today?`,
            teacher: `Hello Teacher ${userData.name}! I am your AI Lesson Planner & Grading Assistant. What are we teaching today?`,
            student: `Hey ${userData.name}! 👋 I am your AI Study Buddy. Ask me anything, let's learn together!`
          };

          const greetingText = roleGreetings[userData.role] || `Hello ${userData.name}! How can I assist you today?`;
          
          setMessages([
            {
              id: 'init-1',
              role: 'model',
              text: greetingText,
              timestamp: new Date()
            }
          ]);
          setProfileLoading(false);
        } else {
          setProfileLoading(false);
        }
      } catch (err) {
        console.error("Failed to load user profile in AIAgentWidget:", err);
        if (!alive) return;
        setProfileLoading(false);
      }
    };

    fetchProfile();

    const timeout = window.setTimeout(() => {
      if (!alive || profile) return;
      setProfileLoading(false);
    }, 10000);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [currentUser]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsgText = inputText.trim();
    setInputText('');
    setError(null);

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      text: userMsgText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const updatedHistory: ChatMessage[] = [
        ...chatHistory,
        { role: 'user', parts: [{ text: userMsgText }] }
      ];

      const response = await askGemini(
        userMsgText,
        undefined,
        updatedHistory,
        {
          role: profile?.role || 'user',
          schoolId: profile?.schoolId || null,
          uid: currentUser?.uid || ''
        }
      );

      if (typeof response === 'object' && response.pendingToolCall) {
        const toolCall = response.pendingToolCall;
        setPendingAction({
          id: `tool-${Date.now()}`,
          name: toolCall.name,
          args: toolCall.args,
          engine: 'AI Copilot'
        });

        const botMessage = {
          id: `model-${Date.now()}`,
          role: 'model' as const,
          text: `Action proposed: **${toolCall.name}**. Please confirm below.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const responseText = typeof response === 'string' ? response : 'Done!';
        const botMessage = {
          id: `model-${Date.now()}`,
          role: 'model' as const,
          text: responseText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        
        setChatHistory([
          ...updatedHistory,
          { role: 'model', parts: [{ text: responseText }] }
        ]);
      }
    } catch (err: any) {
      console.error("AI Widget error:", err);
      setError(err.message || 'Failed to get response from AI agent.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeTool(pendingAction.name, pendingAction.args, {
        userRole: profile?.role || 'user',
        schoolId: profile?.schoolId || 'unknown',
        userId: currentUser?.uid || 'unknown'
      });

      const confirmMsg = {
        id: `confirm-${Date.now()}`,
        role: 'model' as const,
        text: `✅ Action executed successfully!\n\n**Result:**\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMsg]);
      setPendingAction(null);
    } catch (err: any) {
      console.error("Tool execution error:", err);
      setError(`Tool execution failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAction = () => {
    if (!pendingAction) return;
    const cancelMsg = {
      id: `cancel-${Date.now()}`,
      role: 'model' as const,
      text: `❌ Action **${pendingAction.name}** was cancelled.`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, cancelMsg]);
    setPendingAction(null);
  };

  if (!currentUser) return null;

  if (profileLoading) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <button className="relative flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-3 text-slate-700 shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="hidden sm:inline text-sm font-bold">Loading Smart Copilot…</span>
        </button>
      </div>
    );
  }

  if (!profile || !allowedRoles.has(profile.role)) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setHasNewResponse(false);
          }}
          className="relative group flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 border border-white/20"
        >
          <span className="text-2xl">🤖</span>
          <span className="font-bold pr-2 hidden sm:inline text-sm tracking-wide">Smart Copilot</span>
          {hasNewResponse && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
          )}
        </button>
      )}

      {isOpen && (
        <div className="bg-white/95 backdrop-blur-xl w-[calc(100vw-2rem)] sm:w-[420px] h-[min(580px,calc(100dvh-2rem))] sm:h-[580px] rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 text-white flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl shadow-inner">
                ⚡
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight text-slate-100">Smart Copilot</h3>
                <p className="text-[11px] text-indigo-300/80 font-medium">
                  Connected to Realtime DB
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10'
                      : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {pendingAction && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                  <span>⚠️</span> Action Required
                </div>
                <p className="text-xs text-amber-900/80">
                  The AI is requesting permission to run <strong>{pendingAction.name}</strong>.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmAction}
                    disabled={isLoading}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition"
                  >
                    Confirm & Run
                  </button>
                  <button
                    onClick={handleCancelAction}
                    disabled={isLoading}
                    className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl border border-slate-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold p-2">
                <span className="animate-spin">⏳</span> AI is processing...
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs font-medium">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Ask anything..."
              disabled={isLoading}
              className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
