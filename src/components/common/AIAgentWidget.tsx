import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { askGemini, executeTool, type ChatMessage } from '../../services/aiService';

interface UserProfile {
  name: string;
  role: string;
  schoolId: string;
  schoolName?: string;
}

export const AIAgentWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
      setMessages([]);
      setChatHistory([]);
      return;
    }

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserProfile;
          setProfile(userData);
          
          // Initial greeting based on role
          const roleGreetings: Record<string, string> = {
            superadmin: `Hello Master Admin ${userData.name}. System global agent initialized. Ready to assist with database repair, platform operations, or system tenant management.`,
            schooladmin: `Welcome, Principal/Admin ${userData.name}. I am your School Operations Copilot. How can I help you manage teachers, schedule terms, or check platform configurations today?`,
            teacher: `Hello Teacher ${userData.name}! I am your AI Lesson Planner & Grading Assistant. What are we teaching today? I can outline lesson plans, write announcements, or draft test questions for you!`,
            student: `Hey ${userData.name}! 👋 I am your AI Study Buddy. Got any tricky homework, math equations, or history questions? Ask me anything, let's learn together!`,
            registrar: `Greetings, Registrar ${userData.name}. I am your Admissions and Enrollment Assistant. Need help organizing student rosters or reviewing enrollment parameters?`
          };

          const greeting = roleGreetings[userData.role] || `Hello ${userData.name}! I am your SmartSchool AI Assistant. How can I assist you today?`;
          
          setMessages([
            {
              id: 'init-greet',
              role: 'model',
              text: greeting,
              timestamp: new Date()
            }
          ]);
          setChatHistory([
            {
              role: 'model',
              parts: [{ text: greeting }]
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to load user profile for AIAgentWidget:", err);
      }
    };

    fetchProfile();
  }, [currentUser]);

  // General public greeting for landing page when logged out
  useEffect(() => {
    if (!currentUser) {
      const publicGreeting = "Hi there! I am the SmartSchool Platform Agent. 🇱🇷 Ready to help you discover how our SaaS School Portal simplifies student grading, attendance, and administration. Ask me anything about our software packages, cloud billing, or registrations!";
      setMessages([
        {
          id: 'public-greet',
          role: 'model',
          text: publicGreeting,
          timestamp: new Date()
        }
      ]);
      setChatHistory([
        {
          role: 'model',
          parts: [{ text: publicGreeting }]
        }
      ]);
    }
  }, [currentUser]);

  // Scroll to bottom on message update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const getSystemPrompt = (): string => {
    const basePrompt = "You are 'LSP Agent' (Liberia SmartSchool Portal Assistant), an advanced, friendly, and helpful AI assistant embedded in the 'SmartSchool' SaaS portal designed for Liberian schools. Always answer in clear English. Keep formatting neat with line breaks, bullet points, and clean highlights. Avoid overly technical jargon unless asked.";
    
    if (!currentUser || !profile) {
      return `${basePrompt} You are addressing the public guest/visitor on our portal landing page. Focus on promoting the benefits of our School Management SaaS, explaining features like offline sync, cloud databases, automatic gradesheets, and registration workflows.`;
    }

    const roles: Record<string, string> = {
      superadmin: "You are the SuperAdmin Platform Agent. Speak directly to platform engineers. You can provide general advice on cloud infrastructure, system maintenance, tenant provisioning, database configurations, and super-user operations.",
      schooladmin: "You are the School Principal's Executive Assistant. Assist with school operations, registration of teachers, managing schedules, creating parent announcements, term calendar setups, and auditing administrative reports.",
      teacher: "You are the Teacher's Lesson Planner and Grading Copilot. Speak as an experienced educational strategist. Help draft structured lesson plans, generate pop-quizzes, create classroom announcements, draft homework templates, and suggest classroom management techniques.",
      student: "You are the Student's Private Study Coach and Homework Companion. Speak in a highly encouraging, simple, and exciting tone. Help explain science, mathematics, geography, and language concepts simply. Break down tough problems step-by-step. Encourage healthy study habits and never give raw answers immediately without explaining.",
      registrar: "You are the Enrollment and Registrar Copilot. Help review registration forms, student profiles, roster layouts, and list criteria for standard admissions workflows."
    };

    return `${basePrompt} Current User Name: ${profile.name}, Role: ${profile.role}. School Context: ${profile.schoolName || 'Liberian SmartSchool'}. ${roles[profile.role] || ''}`;
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg = textToSend.trim();
    setInputText('');
    setError(null);
    setIsLoading(true);

    const newUserMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      text: userMsg,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);

    try {
      const historyToSend = [...chatHistory];

      const systemPrompt = getSystemPrompt();
      const userContext = currentUser && profile ? {
        uid: currentUser.uid,
        role: profile.role,
        schoolId: profile.schoolId
      } : undefined;

      const reply = await askGemini(userMsg, systemPrompt, historyToSend, userContext);

      if (typeof reply !== 'string' && reply && reply.pendingToolCall) {
        setPendingAction(reply.pendingToolCall);
        setChatHistory(prev => [
          ...prev,
          {
            role: 'user',
            parts: [{ text: userMsg }]
          },
          {
            role: 'model',
            parts: [{
              functionCall: {
                name: reply.pendingToolCall.name,
                args: reply.pendingToolCall.args
              }
            }]
          }
        ]);
        return;
      }

      const textReply = typeof reply === 'string' ? reply : "";
      setMessages(prev => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model' as const,
          text: textReply,
          timestamp: new Date()
        }
      ]);
      setChatHistory(prev => [
        ...prev,
        {
          role: 'user',
          parts: [{ text: userMsg }]
        },
        {
          role: 'model',
          parts: [{ text: textReply }]
        }
      ]);
      setHasNewResponse(true);
    } catch (err: any) {
      console.error("Gemini Assistant response failed:", err);
      setError(err.message || "Failed to establish AI connection. Please verify your internet.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAction = async () => {
    if (!pendingAction || !currentUser || !profile) return;
    const action = pendingAction;
    setPendingAction(null);
    setIsLoading(true);
    setError(null);

    try {
      const userContext = {
        uid: currentUser.uid,
        role: profile.role,
        schoolId: profile.schoolId
      };

      // 1. Run the action locally
      const result = await executeTool(action.name, action.args, userContext);

      // 2. Log confirmation to message board
      setMessages(prev => [
        ...prev,
        {
          id: `tool-execute-${Date.now()}`,
          role: 'user' as const,
          text: `[APPROVED ACTION: ${action.name}]`,
          timestamp: new Date()
        },
        {
          id: `tool-result-${Date.now()}`,
          role: 'model' as const,
          text: `[Execution successful. Output: ${JSON.stringify(result)}]`,
          timestamp: new Date()
        }
      ]);

      // 3. Append tool execution outcome as semantic 'tool' response to the chatHistory
      const updatedHistory: ChatMessage[] = [
        ...chatHistory,
        {
          role: 'tool',
          parts: [{
            functionResponse: {
              name: action.name,
              response: { output: result }
            }
          }]
        }
      ];
      setChatHistory(updatedHistory);

      // 4. Resume discussion with LLM
      const systemPrompt = getSystemPrompt();
      const resumePrompt = `The action '${action.name}' was APPROVED and EXECUTED successfully. Output: ${JSON.stringify(result)}. Please summarize this result nicely and confirm completion to the user.`;

      const reply = await askGemini(
        resumePrompt,
        systemPrompt,
        updatedHistory,
        userContext
      );

      if (typeof reply !== 'string' && reply && reply.pendingToolCall) {
        setPendingAction(reply.pendingToolCall);
        setChatHistory(prev => [
          ...prev,
          {
            role: 'user',
            parts: [{ text: resumePrompt }]
          },
          {
            role: 'model',
            parts: [{
              functionCall: {
                name: reply.pendingToolCall.name,
                args: reply.pendingToolCall.args
              }
            }]
          }
        ]);
        return;
      }

      const textReply = typeof reply === 'string' ? reply : "";
      setMessages(prev => [
        ...prev,
        {
          id: `model-resume-${Date.now()}`,
          role: 'model' as const,
          text: textReply,
          timestamp: new Date()
        }
      ]);
      setChatHistory(prev => [
        ...prev,
        {
          role: 'user',
          parts: [{ text: resumePrompt }]
        },
        {
          role: 'model',
          parts: [{ text: textReply }]
        }
      ]);
      setHasNewResponse(true);
    } catch (err: any) {
      console.error("Approved action failed:", err);
      setError(err.message || "Failed to execute approved action.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectAction = async () => {
    if (!pendingAction || !currentUser || !profile) return;
    const action = pendingAction;
    setPendingAction(null);
    setIsLoading(true);
    setError(null);

    try {
      const userContext = {
        uid: currentUser.uid,
        role: profile.role,
        schoolId: profile.schoolId
      };

      // 1. Log cancellation to message board
      setMessages(prev => [
        ...prev,
        {
          id: `tool-reject-${Date.now()}`,
          role: 'user' as const,
          text: `[CANCELLED ACTION: ${action.name}]`,
          timestamp: new Date()
        }
      ]);

      // 2. Append tool rejection as semantic 'tool' response to the chatHistory
      const updatedHistory: ChatMessage[] = [
        ...chatHistory,
        {
          role: 'tool',
          parts: [{
            functionResponse: {
              name: action.name,
              response: { error: "User rejected / cancelled execution of this action." }
            }
          }]
        }
      ];
      setChatHistory(updatedHistory);

      // 3. Resume discussion with LLM
      const systemPrompt = getSystemPrompt();
      const resumePrompt = `The user REJECTED / CANCELLED execution of ${action.name}. Tell the user that the operation has been successfully aborted as requested.`;

      const reply = await askGemini(
        resumePrompt,
        systemPrompt,
        updatedHistory,
        userContext
      );

      if (typeof reply !== 'string' && reply && reply.pendingToolCall) {
        setPendingAction(reply.pendingToolCall);
        setChatHistory(prev => [
          ...prev,
          {
            role: 'user',
            parts: [{ text: resumePrompt }]
          },
          {
            role: 'model',
            parts: [{
              functionCall: {
                name: reply.pendingToolCall.name,
                args: reply.pendingToolCall.args
              }
            }]
          }
        ]);
        return;
      }

      const textReply = typeof reply === 'string' ? reply : "";
      setMessages(prev => [
        ...prev,
        {
          id: `model-resume-${Date.now()}`,
          role: 'model' as const,
          text: textReply,
          timestamp: new Date()
        }
      ]);
      setChatHistory(prev => [
        ...prev,
        {
          role: 'user',
          parts: [{ text: resumePrompt }]
        },
        {
          role: 'model',
          parts: [{ text: textReply }]
        }
      ]);
      setHasNewResponse(true);
    } catch (err: any) {
      console.error("Cancellation note failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestions = (): string[] => {
    if (!currentUser || !profile) {
      return [
        "What is SmartSchool?",
        "How do schools sign up?",
        "Does this app run offline?",
        "What packages are available?"
      ];
    }

    switch (profile.role) {
      case 'superadmin':
        return ["Database repair routine", "Provision a new school", "Check server health"];
      case 'schooladmin':
        return ["Enroll student Marie Johnson", "Draft parent announcement", "School term checklist"];
      case 'registrar':
        return ["Enroll student Marie Johnson", "Review registration checklist", "Organize school roster"];
      case 'teacher':
        return ["Draft Algebra lesson plan", "Upload Chemistry grade for student Marie", "Draft 9th Grade Physics quiz"];
      case 'student':
        return ["Explain Photosynthesis simply", "Help with algebra formulas", "Encourage me to study!"];
      default:
        return ["What can you do?", "Help me navigate"];
    }
  };

  const allowedRoles = ['schooladmin', 'registrar', 'teacher'];
  if (!currentUser || !profile || !allowedRoles.includes(profile.role)) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setHasNewResponse(false);
          }}
          className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 group border-2 border-white/20"
        >
          {hasNewResponse && (
            <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
            </span>
          )}
          <span className="text-2xl group-hover:rotate-12 transition-transform duration-300">⚡</span>
        </button>
      )}

      {/* Floating Chat Container */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[400px] h-[520px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-850 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-white font-bold text-lg shadow-inner shadow-black/20">
                ⚡
              </div>
              <div>
                <h3 className="text-white font-black text-sm">SmartSchool Copilot</h3>
                <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LSP Agent Active
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroller */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/40 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                  <span className="block text-[8px] text-slate-400 mt-1 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700/40 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-950/40 border border-red-850 p-3 rounded-xl text-xs text-red-300">
                ⚠️ {error}
              </div>
            )}

            {pendingAction && (
              <div className="p-4 bg-slate-800/90 border border-emerald-500/40 rounded-2xl mx-1 my-2 shadow-lg animate-slide-up">
                <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span>🛡️ Approval Required</span>
                </div>
                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  The Copilot wants to perform the following action:
                </p>
                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/50 mb-4 text-xs font-mono text-slate-200 overflow-x-auto">
                  <div className="text-emerald-300 font-bold mb-1">
                    {pendingAction.name === 'provisionUser' ? 'Enroll / Provision User' :
                     pendingAction.name === 'removeStudent' ? 'Remove Student Profile' :
                     pendingAction.name === 'assignStudentToClass' ? 'Assign Student to Class' :
                     pendingAction.name === 'assignTeacher' ? 'Assign Teacher' :
                     pendingAction.name === 'uploadGrade' ? 'Upload Grade Card' :
                     pendingAction.name === 'submitAttendanceBatch' ? 'Submit Attendance' :
                     pendingAction.name}
                  </div>
                  <pre className="text-[10px] whitespace-pre-wrap leading-tight mt-1 text-slate-300">
                    {JSON.stringify(pendingAction.args, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleApproveAction}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95"
                  >
                    Approve & Run
                  </button>
                  <button
                    onClick={handleRejectAction}
                    className="py-2 px-3 bg-slate-700 hover:bg-slate-650 text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto border-t border-slate-800/40 bg-slate-900/50 scrollbar-none">
            {getSuggestions().map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(suggestion)}
                className="whitespace-nowrap text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-750 hover:text-white border border-slate-700/40 px-3 py-1.5 rounded-full transition shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-4 bg-slate-850 border-t border-slate-800/80 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputText)}
              placeholder="Ask me anything..."
              className="flex-1 bg-slate-800 border border-slate-700/60 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500 shadow-inner"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white font-bold disabled:opacity-50 disabled:from-slate-800 disabled:to-slate-800 hover:from-emerald-500 hover:to-cyan-400 transition shadow-md active:scale-95"
            >
              ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
