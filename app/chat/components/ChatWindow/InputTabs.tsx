"use client";

import type React from "react";
import { useState, type RefObject, useCallback, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Shield,
  HelpCircle,
  Scan,
  PauseOctagon,
  Send,
  Eye,
  Code,
  CheckCircle,
  Upload,
  File,
  X,
  CheckCircle2,
} from "lucide-react";
import { getToken } from "@/lib/authService";

interface InputTabsProps {
  input: string;
  setInput: (val: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  inputContainerRef: RefObject<HTMLDivElement>;
  isRendering: boolean;
  handleSendMessage: () => void;
  handleStop: () => void;

  // Suggestions
  suggestions: string[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  filterSuggestions: (val: string) => void;
  selectSuggestion: (val: string) => void;

  setMessages: (msgs: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InputTabs({
  input,
  setInput,
  textareaRef,
  inputContainerRef,
  isRendering,
  handleSendMessage,
  handleStop,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  filterSuggestions,
  selectSuggestion,
  setMessages,
}: InputTabsProps) {
  return (
    <div className="w-full max-w-4xl p-4 border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 lg:rounded-xl mx-auto lg:mb-4">
      <div ref={inputContainerRef} className="relative">
        {showSuggestions && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-gray-300 border-b border-gray-700 last:border-b-0"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              filterSuggestions(e.target.value);

              const el = textareaRef.current;
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
            rows={1}
            placeholder="Ask about web security, vulnerabilities, best practices..."
            className="min-h-[32px] bg-gray-800/50 border-gray-700 focus-visible:ring-cyan-500 overflow-hidden resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isRendering) {
                  handleSendMessage();
                }
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            onFocus={() => {
              if (input.length >= 2) filterSuggestions(input);
            }}
          />
          <Button
            onClick={isRendering ? handleStop : handleSendMessage}
            size="icon"
            className="bg-primary hover:bg-primary/80 mt-auto p-2 h-fit disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRendering ? (
              <PauseOctagon className="w-10 h-10" strokeWidth={2.25} />
            ) : (
              <Send className="w-10 h-10" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}