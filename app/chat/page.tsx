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

  useEffect(() => {
    // Only show modal if loading finished and there was no previous user
    if (!userLoading && !user && prevUserRef.current === null) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false); // hide modal if user is logged in
    }

    // Update previous user
    prevUserRef.current = user;
  }, [user, userLoading]);

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
  const [urlToScan, setUrlToScan] = useState("");
  const [isUrlScanning, setIsUrlScanning] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

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

  const extractUrlFromMessage = (message: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;
    const match = message.match(urlRegex);

    if (!match) return null;

    let url = match[0].trim();

    // If already has protocol, return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Otherwise, prepend http://
    return `http://${url}`;
  };

  // --- Mock scan fetcher ---
  const mockScanFetcher = async (urlToScan: string): Promise<Response> => {
    const fakeScanResult = {
      scanned_output: {
        privacy_risk: {
          header: "Privacy Risk Assessment",
          body: "Based on the VirusTotal scan, the file appears to pose minimal privacy risks...",
        },
        security: {
          header: "Security Assessment",
          body: "The VirusTotal scan indicates a low security risk...",
        },
        data_sharing: {
          header: "Data Sharing Implications",
          body: "The VirusTotal results suggest minimal overt data sharing concerns...",
        },
        overall: {
          malicious: "0 vendors identified the file as malicious.",
          suspicious: "0 vendors identified the file as suspicious.",
          harmless: "66 vendors identified the file as harmless.",
          undetected:
            "31 vendors did not detect the file. This does not indicate safety or threat.",
          timeout: "0 vendors timed out during analysis.",
        },
        flagged_vendors: [],
      },
      type: "analyze",
      conversation_id: Date.now(),
      title: `WAIPayloadScan for ${urlToScan}`,
    };

    // Return a Response object so createChat can call response.json()
    return new Response(JSON.stringify(fakeScanResult), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  // --- mock Gemini classification fetcher ---
  const classifyQuestion = async (question: string): Promise<string> => {
    const text = question.toLowerCase().trim();

    // Expanded keyword sets
    const keywords = {
      analyze: [
        "scan",
        "analyze",
        "analyse",
        "inspect",
        "check",
        "evaluate",
        "detect",
        "review",
        "examine",
        "diagnose",
      ],
      general: [
        "general",
        "chat",
        "talk",
        "discuss",
        "help",
        "support",
        "explain",
        "guide",
      ],
      quiz: ["quiz", "test", "questionnaire", "exam", "practice", "assessment"],
    };

    const matchType = (type: string): boolean => {
      return keywords[type as keyof typeof keywords].some((word) =>
        new RegExp(`\\b${word}\\b`, "i").test(text)
      );
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        if (matchType("analyze")) return resolve("analyze");
        if (matchType("quiz")) return resolve("quiz");
        if (matchType("general")) return resolve("general");
        resolve("general"); // Default fallback
      }, 200); // Slightly faster
    });
  };

  // const classifyQuestion = async (input: string): Promise<string> => {
  //   try {
  //     setDecidingType(true);
  //     console.log("Classifying question:", input);
  //     const token = getToken();
  //     const response = await fetch(`${API_URL}/decisions/`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: token ? `Bearer ${token}` : "",
  //       },
  //       body: JSON.stringify({ question: input }),
  //     });

  //     if (!response.ok) {
  //       throw new Error(`Error fetching decisions: ${response.statusText}`);
  //     }

  //     const data = await response.json();
  //     return data.decision_status === "scan" ? "analyze" : "general";
  //   } catch (error) {
  //     console.error("Error in classifyQuestion:", error);
  //     throw error;
  //   } finally {
  //     setDecidingType(false);
  //   }
  // };

  // --- Step 2: call API depending on type ---
  const callApiByType = async (
    type: string,
    question: string | null,
    token: string | null,
    signal: AbortSignal,
    setMessages?: React.Dispatch<React.SetStateAction<MessageType[]>> // so we can push scan messages
  ): Promise<Response> => {
    // if (type === "analyze") {
    //   return mockScanFetcher(question); // ✅ just return JSON
    // }
    console.log(type);
    let endpoint = "";

    switch (type) {
      case "general":
        endpoint = `${API_URL}/chat/new`;
        break;
      case "analyze":
        endpoint = `${API_URL}/analyze/new`;
        break;
      case "quiz":
        endpoint = `${API_URL}/quiz/generate`;
      // ---- mock scan fetch ----
      default:
        endpoint = `${API_URL}/chat/new`;
    }

    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(
        type === "analyze" ? { url: question } : { question }
      ),
      signal,
    });
  };
  // --- Step 3: orchestrator (your createChat) ---
  const createChat = async () => {
    try {
      const token = getToken();

      // classify type first
      const type = await classifyQuestion(input);
      console.log("Classified type:", type);

      // then call correct API
      const controller = new AbortController();
      const { signal } = controller;

      const url = extractUrlFromMessage(input);
      console.log("url to scan:", url);

      const responsePromise =
        type === "analyze"
          ? callApiByType(type, url, token, signal)
          : callApiByType(type, input, token, signal);

      // Initial bot message
      let botText = "";
      let lastChunk: any = null;

      const botMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        datetime: new Date(),
        status: "info",
        ...(type === "analyze" && {
          isScanning: true,
          scanProgress: 0,
          type: "analyze",
        }),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (type === "analyze") {
        console.log("Starting scan flow");
        setIsUrlScanning(true);
        let finished = false;
        const startTime = Date.now();
        const ESTIMATED_SCAN_TIME = 10000; // 10s baseline

        // ✅ Use the existing botMessage passed from createChat
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessage.id
              ? { ...msg, isScanning: true, scanProgress: 0 }
              : msg
          )
        );

        // Progress updater loop
        const progressLoop = async () => {
          const ESTIMATED_SCAN_TIME = 25000; // 25 seconds
          while (!finished) {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(
              Math.floor((elapsed / ESTIMATED_SCAN_TIME) * 100),
              95 // cap before real response
            );

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessage.id
                  ? { ...msg, scanProgress: progress }
                  : msg
              )
            );

            await new Promise((r) => setTimeout(r, 300));
          }
        };

        // Start progress loop
        progressLoop();

        // === Wait for API ===
        const response = await responsePromise;
        finished = true;

        if (!response.ok) throw new Error("Scan API error");
        const result = await response.json();

        console.log("Scan result:", result);
        let newMessage = null;
        if (result.error) {
          botMessage.content = result.error;
          newMessage = {
            ...botMessage,
            isScanning: false,
            scanProgress: 100,
            scanResults: result.scanned_output ? result.scanned_output : null,
            type: "general",
          };
        } else {
          newMessage = {
            ...botMessage,
            isScanning: false,
            scanProgress: 100,
            scanResults: result.scanned_output,
            type: "analyze",
          };
        }

        console.log("newMessage", newMessage);

        // Final update
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessage.id ? { ...newMessage } : msg
          )
        );

        // Conversation meta
        setConversationId(result.conversation_id);
        setSelectedChatId(result.conversation_id);
        setChatHistory((prev) => [
          {
            user_id: user?.id || 0,
            title: result.title || "New Chat",
            id: result.conversation_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);

        return; // stop here
      }

      setIsTyping(true);
      setIsRendering(true);

      // --- Non-scan: normal streaming flow ---
      const response = await responsePromise;
      if (!response.body) throw new Error("No response body");

      await readStreamingJson(
        response,
        (parsed) => {
          lastChunk = parsed;
          const content = parsed.message?.content || "";
          const cleaned = content.replace("</think>", "");
          botText += cleaned;

          setIsTyping(false);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessage.id ? { ...msg, content: botText } : msg
            )
          );
        },
        stopRef
      );

      // conversation meta for non-scan types
      const conversation_id = lastChunk?.conversation_id;
      const conversation_title = lastChunk?.title || "New Chat";

      setConversationId(conversation_id);
      setSelectedChatId(conversation_id);
      setChatHistory((prev) => [
        {
          user_id: user?.id || 0,
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
  // Sends a user message in an existing conversation
  const sendMessage = async () => {
    try {
      const token = getToken();

      // --- classify first ---
      const type = await classifyQuestion(input);
      console.log("Classified type (sendMessage):", type);

      // --- controller for abort ---
      const controller = new AbortController();
      const { signal } = controller;

      // --- choose correct API ---
      let endpoint = "";
      if (type === "general") {
        endpoint = `${API_URL}/chat/conversation/${conversationId}`;
      } else if (type === "analyze") {
        endpoint = `${API_URL}/analyze/conversation/${conversationId}`;
      } else {
        endpoint = `${API_URL}/chat/conversation/${conversationId}`;
      }

      // --- initial bot message ---
      let botText = "";
      let lastChunk: any = null;

      const botMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        datetime: new Date(),
        status: "info",
        ...(type === "analyze" && {
          isScanning: true,
          scanProgress: 0,
          type: "analyze",
        }),
      };

      setMessages((prev) => [...prev, botMessage]);

      // ===================
      // 🔍 HANDLE ANALYZE
      // ===================
      if (type === "analyze") {
        console.log("Starting scan flow (sendMessage)");
        setIsUrlScanning(true);
        let finished = false;
        const startTime = Date.now();
        const ESTIMATED_SCAN_TIME = 10000; // 10s baseline

        // progress updater loop
        const progressLoop = async () => {
          const ESTIMATED_SCAN_TIME = 25000; // 25 seconds
          while (!finished) {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(
              Math.floor((elapsed / ESTIMATED_SCAN_TIME) * 100),
              95 // cap before real response
            );

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMessage.id
                  ? { ...msg, scanProgress: progress }
                  : msg
              )
            );

            await new Promise((r) => setTimeout(r, 300));
          }
        };
        progressLoop();

        try {
          const inputUrl = extractUrlFromMessage(input);
          // real API call
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify({ url: inputUrl }),
            signal,
          });

          if (!response.ok) throw new Error("Scan API error");

          let result: any = null;
          try {
            result = await response.json();
          } catch (err) {
            console.error("Failed to parse scan JSON:", err);
            result = { error: "Invalid scan response" };
          }

          console.log("Scan result (sendMessage):", result);

          let newMessage: MessageType;
          if (result.error) {
            newMessage = {
              ...botMessage,
              isScanning: false,
              scanProgress: 100,
              scanResults: result.scanned_output || null,
              type: "general",
              content: result.error,
            };
          } else {
            newMessage = {
              ...botMessage,
              isScanning: false,
              scanProgress: 100,
              scanResults: result.scanned_output,
              type: "analyze",
            };
          }

          // update with scan result
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessage.id ? { ...newMessage } : msg
            )
          );
        } finally {
          finished = true; // ✅ ensure progress loop exits
        }

        return; // ✅ stop here for analyze
      }

      // ===================
      // 💬 HANDLE GENERAL
      // ===================
      setIsTyping(true);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: input }),
        signal,
      });

      if (!response.body) throw new Error("ReadableStream not supported");

      console.log("Response body:", response.body);

      await readStreamingJson(
        response,
        (parsed) => {
          console.log("Streaming response:", parsed);
          lastChunk = parsed;
          const content = parsed.message?.content || "";
          const cleaned = content.replace("</think>", "");
          botText += cleaned;

          // mark rendering only once streaming begins
          setIsTyping(false);
          setIsRendering(true);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessage.id
                ? { ...msg, content: botText.trim() }
                : msg
            )
          );
        },
        stopRef
      );
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
    setIsUrlScanning(false);
  };

  const handleUrlScan = async (url: string) => {
    try {
      const token = getToken();
      const controller = new AbortController();
      const { signal } = controller;

      // ✅ Assign controller to stopRef so Stop button works
      stopRef.current = () => {
        controller.abort(); // stop fetch
        finished = true; // stop progress loop
        setIsUrlScanning(false); // reset state
      };

      // ✅ Decide endpoint based on whether conversation exists
      let endpoint = "";
      if (!conversationId) {
        endpoint = `${API_URL}/analyze/new`;
      } else {
        endpoint = `${API_URL}/analyze/conversation/${conversationId}`;
      }

      // Initial scanning message
      const botMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        datetime: new Date(),
        isScanning: true,
        scanProgress: 0,
        type: "analyze",
      };
      setMessages((prev) => [...prev, botMessage]);

      setIsUrlScanning(true);

      // Progress loop simulation
      let finished = false;
      const startTime = Date.now();

      const progressLoop = async () => {
        const ESTIMATED_SCAN_TIME = 25000; // 25s baseline
        while (!finished) {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(
            Math.floor((elapsed / ESTIMATED_SCAN_TIME) * 100),
            95
          );

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessage.id
                ? { ...msg, scanProgress: progress }
                : msg
            )
          );

          await new Promise((r) => setTimeout(r, 300));
        }
      };

      progressLoop();

      // === Fetch request ===
      const inputUrl = extractUrlFromMessage(url);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ url: inputUrl }),
        signal,
      });

      finished = true;
      setIsUrlScanning(false);

      if (!response.ok) throw new Error("Scan API error");
      const result = await response.json();

      let newMessage: MessageType;
      if (result.error) {
        newMessage = {
          ...botMessage,
          isScanning: false,
          scanProgress: 100,
          content: result.error,
          scanResults: result.scanned_output ? result.scanned_output : null,
          type: "general",
        };
      } else {
        newMessage = {
          ...botMessage,
          isScanning: false,
          scanProgress: 100,
          scanResults: result.scanned_output,
          type: "analyze",
        };
      }

      // Update scanning message
      setMessages((prev) =>
        prev.map((msg) => (msg.id === botMessage.id ? { ...newMessage } : msg))
      );

      // ✅ If it was a new conversation, save meta
      if (!conversationId && result.conversation_id) {
        setConversationId(result.conversation_id);
        setSelectedChatId(result.conversation_id);
        setChatHistory((prev) => [
          {
            user_id: user?.id || 0,
            title: result.title || "New Scan",
            id: result.conversation_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (error: any) {
      console.error("Error scanning URL:", error?.message || error);
      setIsUrlScanning(false);
    } finally {
      // ✅ Cleanup stopRef when done
      stopRef.current = false;
      setIsUrlScanning(false);
    }
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
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 flex h-screen w-full">
        {/* Modal for login */}
        <Dialog
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
        </Dialog>
        {/* Side Panel */}
        <SidePanel
          chatHistory={chatHistory}
          setChatHistory={setChatHistory}
          selectedChatId={selectedChatId}
          selectChat={selectChat}
          newChat={newChat}
          setMessages={setMessages}
          isFetching={fetchingHistory}
        />

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
                className="fixed bottom-16 md:bottom-4 right-4 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center animate-bounce"
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
            urlToScan={urlToScan}
            setUrlToScan={setUrlToScan}
            isUrlScanning={isUrlScanning}
            scanUrl={handleUrlScan}
            showAnalysisModal={showAnalysisModal}
            setShowAnalysisModal={setShowAnalysisModal}
            setMessages={setMessages}
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
