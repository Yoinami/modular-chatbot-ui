import { ChatMessage } from "@/app/chat/components/ChatWindow/ChatMessage";
import { ScanResults } from "@/components/scan-results";
import { Progress } from "@radix-ui/react-progress";
import { MessageType } from "../types";
import { ScanResult } from "./ChatWindow/ScanResult";
import ProgressBar from "./ChatWindow/ProgressBar";
import FileScanResult from "./ChatWindow/FileScanResult";


export default function MessageRenderer({ message, isRendering }: { message: MessageType; isRendering: boolean }) {
  
  // console.log('Rendering message:', message);

  // Try to parse only if content looks like JSON
  const parseScanResult = (content: string) => {
    if (!content || typeof content !== "string") return null;

    // Quick check if it looks like JSON
    if (!(content.startsWith("{") && content.endsWith("}"))) return null;

    try {
      const parsedContent = JSON.parse(content);

      if (parsedContent.error) {
        console.warn("Error in scan result:", parsedContent.error);
        return { error: parsedContent.error };
      }

      if (parsedContent.scanned_output) {
        return parsedContent.scanned_output;
      }
    } catch (error) {
      console.warn("Content is not valid JSON:", content);
    }
    return null;
  };

  // console.log('Parsed scan result:', scanResult);
  
  return (
    <div>

      {message.type !== "analyze" &&
      <ChatMessage message={message} isRendering={isRendering} />
      }

      {message.type === "analyze" && scanResult?.error &&
      <ChatMessage message={{ ...message, content: scanResult.error }} isRendering={isRendering} />
      }
      
    </div>
  );
}
