import { useState, useEffect } from "react";
import {BrowserRouter, Routes, Route, Navigate, useNavigate} from "react-router-dom";

import Navbar from "./components/Navbar";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";

import Landing from "./pages/Landing";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import ParentReport from "./pages/ParentReport";
import ContactUs from "./pages/ContactUs";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min.js";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/v1/app/auth/me', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return data.user || null;
      })
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => { active = false; };
  }, []);

  const logout = async () => {
    try {
      await fetch('/v1/app/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      setUser(null);
      navigate('/SignIn');
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.email === "admin@gmail.com";

  // Dark and light mode toggle fuction
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
  document.body.className = darkMode ? "dark-theme" : "light-theme";
  }, [darkMode]);



  return (
    <>
      <Navbar
        isAuthenticated={isAuthenticated}
        logout={logout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {!authReady ? (
        <main className="auth-loading" role="status">Restoring your session…</main>
      ) : <Routes>
        {/* Public Routes- pages that can be seen by the public even without login in */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Landing />
            )
          }
        />

        <Route
          path="/SignIn"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <SignIn setUser={setUser} />
            )
          }
        />

        <Route
          path="/SignUp"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <SignUp setUser={setUser} />
            )
          }
        />

        <Route path="/ContactUs" element={<ContactUs />} />

        {/* Protected Routes-pages that cant be seen without login in */}
        <Route
          path="/upload"
          element={
            isAuthenticated ? (
              <Upload />
            ) : (
              <Navigate to="/SignIn" />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard user={user} />
            ) : (
              <Navigate to="/SignIn" />
            )
          }
        />

        <Route
          path="/report/:id"
          element={
            isAuthenticated ? (
              <ParentReport />
            ) : (
              <Navigate to="/SignIn" />
            )
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>}

    </>
  );
}

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
