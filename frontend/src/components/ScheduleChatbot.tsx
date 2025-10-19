import React, { useState, useRef, useEffect } from 'react';
import './ScheduleChatbot.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ScheduleChatbotProps {
  username: string;
}

const ScheduleChatbot: React.FC<ScheduleChatbotProps> = ({ username }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your schedule assistant. Ask me anything about your schedule! 📅",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickQuestions = [
    "How many shifts do I have this month?",
    "Where am I working?",
    "What are my weekend shifts?",
    "When is my next shift?",
    "What shifts do I have on October 15?",
    "Which site do I work at most?",
    "How many consecutive days do I work?",
    "When are my days off?",
    "Do I have any MD1 shifts?",
    "What's my schedule for next week?",
    "How many PM shifts do I have?",
    "Am I working this weekend?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (question?: string) => {
  const messageText = question || input.trim();
  if (!messageText) return;

  // Add user message
  const userMessage: Message = {
    id: Date.now().toString(),
    text: messageText,
    sender: 'user',
    timestamp: new Date()
  };
  setMessages(prev => [...prev, userMessage]);
  setInput('');
  setLoading(true);

  try {
    const response = await fetch('http://localhost:5051/api/chatbot/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: messageText, username })
    });

    if (!response.ok) throw new Error('Failed to get response');

    // ⬇️ Put the snippet here
    const data: { answer: string; sources?: Array<{ metadata?: any; preview?: string }> } =
      await response.json();

    // Bot answer
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: data.answer,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, botMessage]);

    // OPTIONAL: tiny sources bubble
    if (data.sources?.length) {
      const srcText = data.sources
        .map((s, i) => `#${i + 1} ${s.metadata?.day ? `Day ${s.metadata.day}` : ''}${s.preview ? ` – ${s.preview}` : ''}`)
        .join('\n');

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: `Sources:\n${srcText}`,
          sender: 'bot',
          timestamp: new Date()
        }
      ]);
    }
  } catch (err) {
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: "Sorry, I couldn't process that question. Please try again.",
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setLoading(false);
  }
};


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Icon */}
      <button
        className={`chatbot-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Schedule Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-content">
              <span className="chatbot-avatar">🤖</span>
              <div>
                <h3>Schedule Assistant</h3>
                <span className="chatbot-status">Online</span>
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                <div className="message-bubble">
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message bot">
                <div className="message-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 2 && (
            <div className="quick-questions">
              <div className="quick-questions-label">Quick questions:</div>
              <div className="quick-questions-grid">
                {quickQuestions.slice(0, 6).map((q, i) => (
                  <button
                    key={i}
                    className="quick-question-btn"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="chatbot-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your schedule..."
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="send-btn"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ScheduleChatbot;