import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatConversation, useChatHistory } from "@/hooks/use-chat-history";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function ChatHeader({
  user,
  chatHistory = [],
  selectedChatId,
}: {
  user: {
    username: string;
    email: string;
    expertise: string;
    learning_style: string;
    password: string;
  } | null;
  chatHistory: ChatConversation[];
  selectedChatId: string | null;
}) {
  return (
    <header className="border-b border-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className=" flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="font-semibold">
            {Array.isArray(chatHistory)
              ? chatHistory.find((chat) => chat.id === selectedChatId)?.title ||
                "New Chat"
              : "New Chat"}
          </h1>
        </div>
        
      </div>
    </header>
  );
}
