import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import ChatPage from './components/ChatPage';
import { User } from './types';
import { ThemeProvider } from './contexts/ThemeContext'; // Import ThemeProvider

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const currentUserJson = localStorage.getItem('currentUser');
    if (currentUserJson) {
      try {
        const currentUser: User = JSON.parse(currentUserJson);
        setIsAuthenticated(true);
        setCurrentUserName(currentUser.name);
      } catch (e) {
        console.error("Failed to parse currentUser from localStorage", e);
        // Clear invalid user data to prevent future errors
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLoginSuccess = () => {
    const currentUserJson = localStorage.getItem('currentUser');
    if (currentUserJson) {
      const currentUser: User = JSON.parse(currentUserJson);
      setCurrentUserName(currentUser.name);
    }
    setIsAuthenticated(true);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-black">
        {isAuthenticated ? <ChatPage userName={currentUserName} /> : <AuthPage onLoginSuccess={handleLoginSuccess} />}
      </div>
    </ThemeProvider>
  );
};

export default App;