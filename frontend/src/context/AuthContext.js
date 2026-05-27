'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();
const FLASH_KEY = 'haqms_flash_message';

function setFlashMessage(message) {
  try {
    sessionStorage.setItem(FLASH_KEY, message);
  } catch {}
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // HARDCODED API VALUE: Intentionally hardcoding the backend base URL on the frontend!
  // This violates production standards and prevents simple domain config, but serves as
  // a perfect exercise for internship candidates to move to environment variables.
  const API_BASE_URL = 'http://localhost:5000/api';

  useEffect(() => {
    let active = true;

    const init = async () => {
      // Load any cached auth state first (fast UI)
      const storedToken = localStorage.getItem('haqms_token');
      const storedUser = localStorage.getItem('haqms_user');

      if (storedToken && storedUser) {
        try {
          if (active) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          }
        } catch (e) {
          console.error('Failed to parse user details from localStorage', e);
        }
      }

      // Then validate/refresh session against backend
      try {
        // If we have a token, try /me first
        if (storedToken) {
          const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (meRes.ok) {
            const me = await meRes.json();
            if (active) {
              setUser(me);
              localStorage.setItem('haqms_user', JSON.stringify(me));
            }
            return;
          }
        }

        // Otherwise attempt refresh cookie → new access token
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!refreshRes.ok) {
          if (storedToken || storedUser) {
            setFlashMessage('Your session expired. Please sign in again.');
          }
          if (active) {
            localStorage.removeItem('haqms_token');
            localStorage.removeItem('haqms_user');
            setToken(null);
            setUser(null);
          }
          return;
        }

        const refreshData = await refreshRes.json();
        const newToken = refreshData?.data?.token;
        if (!newToken) return;

        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (!meRes.ok) return;
        const me = await meRes.json();

        if (active) {
          setToken(newToken);
          setUser(me);
          localStorage.setItem('haqms_token', newToken);
          localStorage.setItem('haqms_user', JSON.stringify(me));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Inconsistent API returns nested success format for login
      const receivedToken = data.data.token;
      const receivedUser = data.data.user;

      // SECURITY ISSUE: Storing sensitive auth credentials directly in LocalStorage!
      localStorage.setItem('haqms_token', receivedToken);
      localStorage.setItem('haqms_user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);

      router.push('/dashboard');
      return { success: true };
    } catch (err) {
      console.error('[AUTH-ERROR] Login request failed:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role = 'RECEPTIONIST') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // If registration succeeds, log them in automatically or redirect to login.
      // Notice inconsistency: signup API returns flat user structure inside "user"
      // we can trigger login for them.
      return login(email, password);
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Best-effort: clear server refresh cookie too
    fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setFlashMessage('You have been signed out.');
    localStorage.removeItem('haqms_token');
    localStorage.removeItem('haqms_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        API_BASE_URL, // Exposing hardcoded API base URL for convenience
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function popAuthFlashMessage() {
  try {
    const msg = sessionStorage.getItem(FLASH_KEY);
    if (!msg) return '';
    sessionStorage.removeItem(FLASH_KEY);
    return msg;
  } catch {
    return '';
  }
}
