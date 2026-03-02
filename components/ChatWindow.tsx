import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme hook

interface ChatWindowProps {
  messages: ChatMessage[];
  loading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, loading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { themeColor } = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex mb-4 ${
            message.sender === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md ${
              message.sender === 'user'
                ? 'text-white'
                : 'bg-gray-700 text-gray-100'
            }`}
            style={message.sender === 'user' ? { backgroundColor: themeColor } : {}}
          >
            <p className="whitespace-pre-wrap">{message.text}</p>
            {message.groundingChunks && message.groundingChunks.length > 0 && (
              <div className="mt-2 text-xs text-gray-300">
                <p className="font-semibold mb-1">Kaynaklar:</p>
                <ul className="list-disc pl-4">
                  {message.groundingChunks.map((chunk, index) => {
                    const uri = (chunk as any).web?.uri || (chunk as any).maps?.uri;
                    const title = (chunk as any).web?.title || (chunk as any).maps?.title || uri;
                    return uri ? (
                      <li key={index}>
                        <a
                          href={uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline" // Keeping blue-300 for readability, could derive from themeColor
                          style={{ color: themeColor }} // Apply theme color to links
                        >
                          {title}
                        </a>
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
            <span className="block text-right text-xs mt-1 opacity-75">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start mb-4">
          <div className="max-w-xs p-3 rounded-lg shadow-md bg-gray-700 text-gray-100 animate-pulse">
            <p>Ata yazıyor...</p>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #333;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #777;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;