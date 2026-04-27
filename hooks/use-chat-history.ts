import { useState, useEffect } from "react";
import { getToken } from "@/lib/authService";

export interface ChatConversation {
  user_id: number;
  title: string;
  id: string;
  created_at: string;
  updated_at: string;
}

export const useChatHistory = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const token = getToken();
      const res = await fetch(`${API_URL}/session/default/memory`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      // Transform turns into ChatConversation format
      const history: ChatConversation[] = (data.turns || []).map((turn: any, index: number) => ({
        user_id: 0,
        title: turn.question.slice(0, 30) + (turn.question.length > 30 ? "..." : ""),
        id: `${data.session_id}-${index}`,
        created_at: turn.timestamp,
        updated_at: turn.timestamp,
      })).reverse(); // Most recent first

      setConversations(history);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to fetch chat history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Add this to allow external components to update chat history
  const setChatHistory = (newHistory: ChatConversation[]) => {
    setConversations(newHistory);
  };

  return {
    conversations,
    loading,
    error,
    refetch: fetchHistory,
    setChatHistory,
  };
};
