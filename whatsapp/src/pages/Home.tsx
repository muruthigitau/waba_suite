import {
  Archive,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Settings,
  Smile,
  Star,
  Users,
  Video,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
  typing: boolean;
  isGroup: boolean;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isSent: boolean;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "reaction";
  reactions?: { emoji: string; count: number }[];
  replyTo?: {
    content: string;
    sender: string;
  };
}

const Home: React.FC = () => {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      name: "Sarah Johnson",
      avatar: "SJ",
      lastMessage: "Hey! How are you?",
      timestamp: "10:30 AM",
      unreadCount: 2,
      online: true,
      typing: false,
      isGroup: false,
    },
    {
      id: "2",
      name: "Design Team",
      avatar: "DT",
      lastMessage: "Great work on the project!",
      timestamp: "Yesterday",
      unreadCount: 0,
      online: false,
      typing: true,
      isGroup: true,
    },
    {
      id: "3",
      name: "Mike Chen",
      avatar: "MC",
      lastMessage: "See you at the meeting",
      timestamp: "Yesterday",
      unreadCount: 0,
      online: false,
      typing: false,
      isGroup: false,
    },
    {
      id: "4",
      name: "Emma Wilson",
      avatar: "EW",
      lastMessage: "Thanks for your help!",
      timestamp: "Monday",
      unreadCount: 0,
      online: true,
      typing: false,
      isGroup: false,
    },
  ]);

  const [messages, setMessages] = useState<Record<string, Message[]>>({
    "1": [
      {
        id: "1",
        content: "Hey! How are you?",
        timestamp: "10:30 AM",
        isSent: false,
        status: "read",
        type: "text",
      },
      {
        id: "2",
        content: "I'm doing great! Working on the new feature.",
        timestamp: "10:31 AM",
        isSent: true,
        status: "read",
        type: "text",
      },
      {
        id: "3",
        content: "That's awesome! Let me know if you need any help.",
        timestamp: "10:32 AM",
        isSent: false,
        status: "read",
        type: "text",
      },
    ],
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setShowSidebar(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getCurrentChat = () => {
    return chats.find((chat) => chat.id === selectedChat);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChat) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageInput,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isSent: true,
      status: "sent",
      type: "text",
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChat]: [...(prev[selectedChat] || []), newMessage],
    }));

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === selectedChat
          ? { ...chat, lastMessage: messageInput, timestamp: "Just now" }
          : chat,
      ),
    );

    setMessageInput("");

    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [selectedChat]: prev[selectedChat].map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: "delivered" } : msg,
        ),
      }));
    }, 1000);

    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [selectedChat]: prev[selectedChat].map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: "read" } : msg,
        ),
      }));
    }, 2000);

    setTimeout(() => {
      const replyMessage: Message = {
        id: Date.now().toString(),
        content: "Thanks for your message!",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSent: false,
        status: "read",
        type: "text",
      };
      setMessages((prev) => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] || []), replyMessage],
      }));
    }, 3000);
  };

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="w-3 h-3" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div
        className={`${
          showSidebar ? "flex" : "hidden"
        } ${isMobile ? "absolute inset-0 z-20" : "relative w-96"} flex-col bg-white border-r border-gray-200`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
              JD
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">John Doe</h2>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <Users className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <MessageCircle className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setSelectedChat(chat.id);
                if (isMobile) setShowSidebar(false);
              }}
              className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer transition ${
                selectedChat === chat.id ? "bg-gray-50" : ""
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                  {chat.avatar}
                </div>
                {chat.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div className="flex-1 ml-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">
                      {chat.name}
                    </span>
                    {chat.isGroup && (
                      <Users className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {chat.timestamp}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-500 truncate max-w-[180px]">
                    {chat.typing ? (
                      <span className="text-green-500">Typing...</span>
                    ) : (
                      chat.lastMessage
                    )}
                  </p>
                  {chat.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-xs text-white">
                        {chat.unreadCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition w-full">
              <Archive className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">Archived</span>
            </button>
            <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition w-full">
              <Star className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">Starred</span>
            </button>
            <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition w-full">
              <Settings className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">Settings</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {isMobile && (
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="p-1 hover:bg-gray-100 rounded-full transition mr-2"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                    {getCurrentChat()?.avatar}
                  </div>
                  {getCurrentChat()?.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {getCurrentChat()?.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {getCurrentChat()?.typing
                      ? "Typing..."
                      : getCurrentChat()?.online
                        ? "Online"
                        : "Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button className="p-2 hover:bg-gray-100 rounded-full transition">
                  <Phone className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition">
                  <Video className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages[selectedChat]?.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] ${
                      message.isSent
                        ? "bg-green-500 text-white"
                        : "bg-white text-gray-800"
                    } rounded-lg px-4 py-2 shadow-sm`}
                  >
                    {message.replyTo && (
                      <div className="mb-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                        <p className="font-semibold">
                          Replying to {message.replyTo.sender}
                        </p>
                        <p className="truncate">{message.replyTo.content}</p>
                      </div>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <span className="text-[10px] opacity-70">
                        {message.timestamp}
                      </span>
                      {message.isSent && getMessageStatusIcon(message.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <button className="p-2 hover:bg-gray-100 rounded-full transition">
                  <Smile className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message"
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-green-500 hover:bg-green-600 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                <MessageCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                WhatsApp Web
              </h3>
              <p className="text-gray-500">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {isMobile && !showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="fixed bottom-4 left-4 p-3 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Home;
