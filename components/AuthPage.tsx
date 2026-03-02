import React, { useState } from 'react';
import Input from './Input';
import Button from './Button';
import { AuthState, User } from '../types';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme hook

interface AuthPageProps {
  onLoginSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const { themeColor } = useTheme();

  const [authState, setAuthState] = useState<AuthState>('login');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const clearForm = () => {
    setName('');
    setSurname('');
    setPhone('');
    setPassword('');
    setError('');
  };

  const handleToggleAuthState = () => {
    clearForm();
    setAuthState(authState === 'login' ? 'signup' : 'login');
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users: User[] = JSON.parse(localStorage.getItem('users') || '[]');

    if (authState === 'signup') {
      const userExists = users.some(u => u.phone === phone);
      if (userExists) {
        setError('Bu telefon numarası zaten kayıtlı.');
        return;
      }
      const newUser: User = { name, surname, phone, password };
      localStorage.setItem('users', JSON.stringify([...users, newUser]));
      alert('Kayıt başarılı! Lütfen giriş yapın.');
      clearForm();
      setAuthState('login');
    } else { // login
      const user = users.find(u => u.phone === phone && u.password === password);
      if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        onLoginSuccess();
      } else {
        setError('Geçersiz telefon numarası veya şifre.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-white mb-6">
          {authState === 'login' ? 'Giriş Yap' : 'Üye Ol'}
        </h2>
        {error && <p className="text-red-400 text-center mb-4">{error}</p>}
        <form onSubmit={handleAuth}>
          <Input
            id="name"
            label="Adınız"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="surname"
            label="Soyadınız"
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            required
          />
          <Input
            id="phone"
            label="Telefon Numarası"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Şifre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full mt-6" size="lg">
            {authState === 'login' ? 'Giriş Yap' : 'Üye Ol'}
          </Button>
        </form>
        <p className="text-center text-gray-400 mt-6">
          {authState === 'login' ? 'Hesabınız yok mu?' : 'Zaten hesabınız var mı?'}
          <button
            onClick={handleToggleAuthState}
            className="ml-2 hover:underline"
            style={{ color: themeColor }} // Apply theme color
          >
            {authState === 'login' ? 'Üye Ol' : 'Giriş Yap'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;