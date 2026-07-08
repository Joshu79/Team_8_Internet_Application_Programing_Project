import { useState, useEffect } from "react";
import {BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate} from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
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
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    setUser(storedUser ? JSON.parse(storedUser) : null);
  }, [location]);

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/SignIn");
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

      <Routes>
        {/* Public Routes- pages that can be seen by the public even without login in */}
        <Route path="/" element={<Landing />} />

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
              <SignUp />
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
              <Dashboard />
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
      </Routes>

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