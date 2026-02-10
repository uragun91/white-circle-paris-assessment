"use client";

import { useState } from "react";
import SidePanel from "./SidePanel";
import ChatArea from "./ChatArea";

export default function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [historyTick, setHistoryTick] = useState(0);

  return (
    <div className="flex h-screen min-h-0 bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <SidePanel onSelect={(id) => setSelectedChatId(id)} refreshTick={historyTick} />
      <ChatArea
        selectedChatId={selectedChatId}
        onChatId={(id) => {
          setSelectedChatId(id);
          // Signal side panel to refresh history when a new chat is created
          setHistoryTick((v) => v + 1);
        }}
      />
    </div>
  );
}
