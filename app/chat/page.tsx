"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Send,
  ArrowLeft,
  Scan,
  Eye,
  Code,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  CircleStop,
  OctagonMinus,
  CircleSlash2,
  PauseOctagon,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { ChatTypingIndicator } from "@/components/chat-typing-indicator";
import { autoSuggestQueries, welcomeMessage } from "./mockdata";
import { MessageType } from "./types";
import { useAuth } from "@/context/AuthContext";
import SidePanel from "./components/Panel/SidePanel";
import MessageRenderer from "./components/MessageRenderer";
import InputTabs from "./components/ChatWindow/InputTabs";
import ChatHeader from "./components/ChatWindow/ChatHeader";
import WelcomeMessage from "./components/ChatWindow/WelcomeMessage";
import { getToken } from "@/lib/authService";
import { readStreamingJson } from "@/lib/utils";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useConversationMessages } from "@/hooks/use-conversation-messages";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useMessage } from "@/context/MessageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import DecidingIndicator from "./components/ChatWindow/DecidingIndicator";

export default function ChatPage() {
  const { user, loading: userLoading, refetch } = useAuth();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const prevUserRef = useRef(false);

  /* useEffect(() => {
    // Only show modal if loading finished and there was no previous user
    if (!userLoading && !user && prevUserRef.current === null) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false); // hide modal if user is logged in
    }

    // Update previous user
    prevUserRef.current = user;
  }, [user, userLoading]); */

  const handleConfirmLogin = () => {
    setShowLoginModal(false);
    router.push("/login");
  };

  const {
    conversations: chatHistory,
    loading: fetchingHistory,
    error,
    refetch: refetchChatHistory,
    setChatHistory,
  } = useChatHistory();

  useEffect(() => {
    refetch(); // force refresh when entering chat page
  }, [refetch]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const {
    messages,
    setMessages,
    refetch: refetchConversationMessages,
  } = useConversationMessages(selectedChatId);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const stopRef = useRef(false);
  const controller = new AbortController();
  const signal = controller.signal;

  const [decidingType, setDecidingType] = useState(false);

  const filterSuggestions = (inputValue: string) => {
    if (inputValue.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = autoSuggestQueries
      .filter((query) => query.toLowerCase().includes(inputValue.toLowerCase()))
      .slice(0, 5);

    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputContainerRef.current &&
        !inputContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  
  // Sync session messages with memory turns if needed
  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch(`${API_URL}/session/default/memory`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.turns) {
          const transformed = data.turns.flatMap((turn: any) => [
            {
              id: `q-${turn.timestamp}`,
              role: "user",
              content: turn.question,
              datetime: turn.timestamp
            },
            {
              id: `a-${turn.timestamp}`,
              role: "assistant",
              content: turn.answer,
              datetime: turn.timestamp
            }
          ]);
          setMessages(transformed);
        }
      } catch (e) {
        console.error("Failed to sync memory:", e);
      }
    };
    
    if (!selectedChatId) {
      fetchMemory();
    }
  }, [selectedChatId, API_URL, setMessages]);

  // --- mock classification fetcher ---
  const classifyQuestion = async (question: string): Promise<string> => {
    return "general";
  };

  // --- Step 2: call API ---
  const callApiByType = async (
    type: string,
    question: string | null,
    token: string | null,
    signal: AbortSignal
  ): Promise<Response> => {
    return fetch(`${API_URL}/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify({ 
        question,
        session_id: conversationId || "default" 
      }),
      signal,
    });
  };

  // --- Step 3: orchestrator (your createChat) ---
  const createChat = async () => {
    try {
      const token = getToken();

      // then call correct API
      const controller = new AbortController();
      const { signal } = controller;

      const responsePromise = callApiByType("general", input, token, signal);

      // Initial bot message
      const botMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        datetime: new Date(),
        status: "info",
      };

      setMessages((prev) => [...prev, botMessage]);

      setIsTyping(true);
      setIsRendering(true);

      const response = await responsePromise;
      if (!response.ok) throw new Error("API error");

      let botText = "";
      let session_id = "";

      await readStreamingJson(
        response,
        (chunk) => {
          if (chunk.answer) {
            botText += chunk.answer.replace("</think>", "");
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessage.id ? { ...msg, content: botText } : msg
              )
            );
          }
          if (chunk.session_id) {
            session_id = chunk.session_id;
          }
        },
        stopRef,
        controller
      );

      setIsTyping(false);
      setIsRendering(false);

      // conversation meta
      const conversation_id = session_id || Date.now().toString();
      const conversation_title = input.slice(0, 30) + "...";

      setConversationId(conversation_id);
      setSelectedChatId(conversation_id);
      
      // Update history if setChatHistory is a state setter for ChatConversation[]
      // We'll skip the user?.id error by using 0 for now as in the previous code
      // @ts-ignore - fix for setChatHistory functional update if its type is complex
      setChatHistory((prev: any[]) => [
        {
          user_id: 0,
          title: conversation_title,
          id: conversation_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error: any) {
      console.error("Error creating chat:", error?.message || error);
    }
  };

  // Sends a user message in an existing conversation
  const sendMessage = async () => {
    try {
      const token = getToken();

      // --- controller for abort ---
      const controller = new AbortController();
      const { signal } = controller;

      // --- choose correct API ---
      let endpoint = `${API_URL}/query/stream`;

      // --- initial bot message ---
      const botMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        datetime: new Date(),
        status: "info",
      };

      setMessages((prev) => [...prev, botMessage]);

      setIsTyping(true);
      setIsRendering(true);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          question: input,
          session_id: conversationId || "default"
        }),
        signal,
      });

      if (!response.ok) throw new Error("API error");
      
      let botText = "";

      await readStreamingJson(
        response,
        (chunk) => {
          if (chunk.answer) {
            botText += chunk.answer.replace("</think>", "");
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessage.id
                  ? { ...msg, content: botText.trim() }
                  : msg
              )
            );
          }
        },
        stopRef,
        controller
      );

      // mark rendering finished
      setIsTyping(false);
      setIsRendering(false);
    } catch (error: any) {
      console.error("Error sending message:", error?.message || error);
    }
  };

  // Handles user message submission
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setShowSuggestions(false);
    stopRef.current = false;

    // Add user message to chat
    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      datetime: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Decide whether to create a new chat or send in existing conversation
    if (messages.length === 0) {
      await createChat(); // first message
    } else {
      await sendMessage(); // subsequent messages
    }

    setIsTyping(false);
    setIsRendering(false);
  };

  //stop fetching tokens from text generation API
  const handleStop = () => {
    stopRef.current = true;
    setIsRendering(false);
    setIsTyping(false);
  };

  const selectSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 50; // tolerance
    setIsUserAtBottom(atBottom);
  };

  // Scroll to bottom function
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // On initial render, scroll to bottom immediately
  useEffect(() => {
    scrollToBottom(false); // instant scroll
  }, []);

  // When messages update, scroll only if user is at bottom
  useEffect(() => {
    if (isUserAtBottom) {
      scrollToBottom();
    }
  }, [messages, isUserAtBottom]);

  function selectChat(id: string): void {
    setSelectedChatId(id);
    setConversationId(id);
  }

  const newChat = () => {
    if (messages.length === 0) {
      return;
    }
    setSelectedChatId(null);
    setMessages([]);
  };

  return (
    <SidebarProvider>
      <div className="bg-background flex h-screen w-full">
        {/* Modal for login */}
        {/* <Dialog
          open={showLoginModal}
          onOpenChange={setShowLoginModal} // Prevent closing when clicking outside
        >
          <DialogContent
            className="max-w-sm md:max-w-md w-full p-6"
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Login Required</DialogTitle>
              <DialogDescription>
                You need to login first to access this page.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowLoginModal(false)}
              >
                Cancel
              </Button>
              <Button className="mb-2 md:mb-0" onClick={handleConfirmLogin}>
                Go to Login
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> */}
        {/* Side Panel */}
        {/* <SidePanel
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          selectedChatId={selectedChatId}
          selectChat={selectChat}
          newChat={newChat}
          setMessages={setMessages}
          isFetching={fetchingHistory}
        /> */}

        <main className="flex flex-col w-full h-screen  relative">
          <ChatHeader
            user={user}
            chatHistory={chatHistory}
            selectedChatId={selectedChatId}
          />
          {/* scrollable area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto scrollbar-none lg:p-4 space-y-4 min-h-0 container mx-auto max-w-5xl"
          >
            {selectedChatId === null && messages.length === 0 ? (
              <WelcomeMessage />
            ) : (
              <>
                {messages?.map((message, index) => (
                  <div key={index}>
                    <MessageRenderer
                      message={message}
                      isRendering={isRendering}
                    />
                  </div>
                ))}
                {/* {isTyping && <ChatTypingIndicator />} */}
                {(isTyping || decidingType) && <DecidingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}

            {!isUserAtBottom && (
              <button
                onClick={() => scrollToBottom()}
                className="fixed bottom-16 md:bottom-4 right-4 z-50 p-3 bg-primary hover:bg-primary/80 text-white rounded-full shadow-lg flex items-center justify-center animate-bounce"
              >
                <ChevronDown size={24} />
              </button>
            )}
          </div>

          {/* Fixed input area */}
          <InputTabs
            input={input}
            setInput={setInput}
            textareaRef={textareaRef}
            inputContainerRef={inputContainerRef}
            isRendering={isRendering}
            handleSendMessage={handleSendMessage}
            handleStop={handleStop}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            filterSuggestions={filterSuggestions}
            selectSuggestion={selectSuggestion}
            setMessages={setMessages}
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
