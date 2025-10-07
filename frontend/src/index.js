// src/index.js (CRA)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import CustomerManagementPage from "./pages/CustomerManagementPage";
import "./index.css";

function Root() {
  const [user, setUser] = React.useState(null);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onAuthed={setUser} />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/" element={user ? <App /> : <Navigate to="/login" replace />} />
        <Route path="/customers" element={user ? <CustomerManagementPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Render the app directly
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
