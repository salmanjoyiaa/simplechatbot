"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  metadata?: any;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const supabase = createSupabaseClient();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations when user is set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user?.id) {
      const loadConversations = async (userId: string) => {
        try {
          const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (!error && data) {
            setConversations(data);
            if (data.length > 0) {
              selectConversation(data[0].id);
            } else {
              // Auto-create first conversation if none exist
              const { data: newConv, error: createError } = await supabase
                .from("conversations")
                .insert({
                  user_id: userId,
                  title: "New Chat",
                })
                .select()
                .single();

              if (!createError && newConv) {
                setConversations([newConv]);
                selectConversation(newConv.id);
              }
            }
          }
        } catch (error) {
          console.error("Error loading conversations:", error);
        }
      };
      
      loadConversations(user.id);
    }
  }, [user?.id]);

  // Initialize - Require authentication
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        
        if (!user) {
          // Redirect to login if not authenticated
          router.push("/auth/login");
          return;
        }
        
        setUser(user);
      } catch (error) {
        console.error("Auth error:", error);
        router.push("/auth/login");
      }
    };

    initUser();
  }, [router]);

  const createNewConversation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: "New Chat",
        })
        .select()
        .single();

      if (!error && data) {
        setConversations([data, ...conversations]);
        selectConversation(data.id);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const selectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setOffset(0);
    setMessages([]);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
        // Check if last message has pagination
        if (data.length > 0) {
          const lastMessage = data[data.length - 1];
          if (lastMessage.metadata?.has_more) {
            setHasMore(true);
          }
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) {
      return;
    }

    // Ensure we have a conversation
    if (!currentConversationId) {
      console.log("No conversation ID, creating one first");
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("conversations")
          .insert({
            user_id: user.id,
            title: "New Chat",
          })
          .select()
          .single();

        if (error || !data) {
          console.error("Failed to create conversation:", error);
          alert("Failed to create conversation. Please try again.");
          return;
        }
        
        setConversations([data, ...conversations]);
        setCurrentConversationId(data.id);
      } catch (error) {
        console.error("Error creating conversation:", error);
        alert("Error creating conversation");
        return;
      }
    }

    const userMessage = input;
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId,
          offset: 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("API error:", data);
        alert("Error: " + (data.error || "Failed to send message"));
        return;
      }

      if (response.ok) {
        setMessages([
          ...messages,
          { id: "user-" + Date.now(), content: userMessage, role: "user" },
          {
            id: data.message?.id || "assistant-" + Date.now(),
            content: data.message?.content || data.response || "Response generated",
            role: "assistant",
            metadata: data.message?.metadata,
          },
        ]);

        setHasMore(data.hasMore);
        setOffset(0);

        // Update conversation title if it's still "New Chat"
        const conversation = conversations.find(
          (c) => c.id === currentConversationId
        );
        if (conversation?.title === "New Chat") {
          await supabase
            .from("conversations")
            .update({ title: userMessage.substring(0, 50) })
            .eq("id", currentConversationId);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Error: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const loadMoreResults = () => {
    if (!currentConversationId || !hasMore) return;

    const newOffset = offset + 5;
    setOffset(newOffset);

    // Get last user message and resend with new offset
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (lastUserMessage) {
      resendWithOffset(lastUserMessage.content, newOffset);
    }
  };

  const resendWithOffset = async (message: string, newOffset: number) => {
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId: currentConversationId,
          offset: newOffset,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Replace last assistant message with new paginated results
        const newMessages = [...messages];
        newMessages[newMessages.length - 1] = {
          id: data.message.id,
          content: data.message.content,
          role: "assistant",
          metadata: data.message.metadata,
        };

        setMessages(newMessages);
        setHasMore(data.hasMore);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error("Error loading more results:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewConversation}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                currentConversationId === conv.id ? "bg-indigo-50" : ""
              }`}
            >
              <p className="text-sm font-medium text-gray-800 truncate">
                {conv.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(conv.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-3">
            {user.email || "Guest User"}
          </p>
          <button
            onClick={handleLogout}
            className="w-full text-sm text-gray-600 hover:text-gray-900 py-2 px-3 rounded hover:bg-gray-100 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">Property ChatBot</h1>
          <p className="text-sm text-gray-600">
            Ask questions about properties in natural language
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-600 mb-6">
                Ask me about properties, locations, owners, or any available
                information
              </p>
              <div className="space-y-2 text-left max-w-md mx-auto">
                <p className="font-semibold text-gray-700 mb-3">Example questions:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• &quot;Show me properties in New Jersey&quot;</li>
                  <li>• &quot;What properties have WiFi?&quot;</li>
                  <li>• &quot;Who has the most properties?&quot;</li>
                  <li>• &quot;What information do you have?&quot;</li>
                </ul>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-900"
                } px-4 py-2 rounded-lg`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.role === "assistant" && msg.content.includes("|") && (
                  <div className="mt-2 text-xs opacity-75">
                    Table preview loaded
                  </div>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center py-4">
              <button
                onClick={loadMoreResults}
                disabled={loading}
                className="text-sm text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 font-medium"
              >
                {loading ? "Loading..." : "Load more results"}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about properties..."
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition"
            >
              {loading ? "..." : "Send"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
