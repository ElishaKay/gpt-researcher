import { useState, useEffect } from 'react';
import { ChatHistoryItem, ChatMessage } from '../types/data';

const MAX_HISTORY_ITEMS = 50; // Maximum number of chat history items to keep
const MAX_MESSAGES_PER_ITEM = 100; // Maximum number of messages per chat item

export const useChatHistory = () => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  
  // Load history from localStorage on initial render
  useEffect(() => {
    const storedHistory = localStorage.getItem('chatHistory');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        // Clean up history on load if needed
        const cleanedHistory = cleanHistory(parsedHistory);
        setHistory(cleanedHistory);
        // Save cleaned history back to localStorage
        localStorage.setItem('chatHistory', JSON.stringify(cleanedHistory));
      } catch (error) {
        console.error('Error parsing chat history:', error);
        localStorage.removeItem('chatHistory');
      }
    }
  }, []);

  // Clean up history to prevent quota exceeded errors
  const cleanHistory = (historyItems: ChatHistoryItem[]): ChatHistoryItem[] => {
    // Sort by timestamp (newest first)
    const sortedHistory = [...historyItems].sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only the most recent MAX_HISTORY_ITEMS
    const limitedHistory = sortedHistory.slice(0, MAX_HISTORY_ITEMS);
    
    // For each item, limit the number of messages
    return limitedHistory.map(item => ({
      ...item,
      messages: item.messages.slice(-MAX_MESSAGES_PER_ITEM)
    }));
  };

  // Save chat to history
  const saveChat = (messages: ChatMessage[]) => {
    try {
      const newItem: ChatHistoryItem = {
        id: Date.now().toString(),
        messages: messages.slice(-MAX_MESSAGES_PER_ITEM), // Only keep the most recent messages
        timestamp: Date.now(),
      };

      const updatedHistory = [newItem, ...history];
      const cleanedHistory = cleanHistory(updatedHistory);
      
      setHistory(cleanedHistory);
      localStorage.setItem('chatHistory', JSON.stringify(cleanedHistory));
      return newItem.id;
    } catch (error) {
      console.error('Error saving chat history:', error);
      // If saving fails, try to clear some space
      try {
        // Keep only the most recent item
        const minimalHistory = [newItem];
        setHistory(minimalHistory);
        localStorage.setItem('chatHistory', JSON.stringify(minimalHistory));
      } catch (retryError) {
        console.error('Failed to save even minimal history:', retryError);
        localStorage.removeItem('chatHistory');
      }
      return newItem.id;
    }
  };

  // Get a specific chat item by ID
  const getChatById = (id: string) => {
    return history.find(item => item.id === id);
  };

  // Delete a chat item
  const deleteChat = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
  };

  // Clear all history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('chatHistory');
  };

  return {
    history,
    saveChat,
    getChatById,
    deleteChat,
    clearHistory,
  };
}; 