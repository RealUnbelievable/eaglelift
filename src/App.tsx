// React hooks for state and lifecycle behavior
import { useState, useEffect } from "react";

// Import CSS styles
import "./App.css";

function App() {
  /* =========================
     SCREEN / PAGE STATE
     ========================= */

  // Controls which screen is shown:
  // "login" | "register" | "dashboard"
  const [screen, setScreen] = useState("login");

  /* =========================
     USER INPUT STATE
     ========================= */

  // Username entered by the user
  const [username, setUsername] = useState("");

  // Password entered by the user
  const [password, setPassword] = useState("");

  /* =========================
     DATE & TIME STATE
     ========================= */

  // Stores the current time
  const [time, setTime] = useState(new Date());

  // Runs once when app loads
  // Updates the clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Cleanup when component unmounts
    return () => clearInterval(timer);
  }, []);

  /* =========================
     REGISTER FUNCTION
     ========================= */

  const register = () => {
    // Force username to lowercase
    const user = username.toLowerCase();

    // Basic validation
    if (!user || !password) {
      alert("Fill in all fields");
      return;
    }

    // Save credentials in browser storage
    // (Temporary — for learning only)
    localStorage.setItem("gymUser", user);
    localStorage.setItem("gymPass", password);

    // Go to logged-in screen
    setScreen("dashboard");
  };

  /* =========================
     LOGIN FUNCTION
     ========================= */

  const login = () => {
    // Get saved credentials
    const savedUser = localStorage.getItem("gymUser");
    const savedPass = localStorage.getItem("gymPass");

    // Force lowercase username
    const user = username.toLowerCase();

    // Check credentials
    if (user === savedUser && password === savedPass) {
      setScreen("dashboard");
    } else {
      alert("Invalid login");
    }
  };

  /* =========================
     UI / JSX
     ========================= */

  return (
    <div className="app">
      
      {/* Top-left date & time (visible on every page) */}
      <div className="clock">
        {time.toLocaleTimeString([], {
         hour: "2-digit",
         minute: "2-digit",
        } as Intl.DateTimeFormatOptions)}
        <div className = "date">
          {time.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric"})}
        </div>
      </div>

      {/* ================= DASHBOARD SCREEN ================= */}
      {screen === "dashboard" && (
        <div className="center">
          <h1>You’re logged in</h1>

          {/* ADD FUTURE FEATURES HERE:
              - Workout tracker
              - Log exercises
              - Logout button
          */}
        </div>
      )}

      {/* ================= REGISTER SCREEN ================= */}
      {screen === "register" && (
        <div className="center">
          <h1>Register</h1>

          {/* Username input */}
          <input
            placeholder="Username"
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase())
            }
          />

          {/* Password input */}
          <input
            type="password"
            placeholder="Password"
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          {/* Create account button */}
          <button onClick={register}>
            Create Account
          </button>

          {/* Back to login */}
          <button
            className="secondary"
            onClick={() => setScreen("login")}
          >
            Back to Login
          </button>
        </div>
      )}

      {/* ================= LOGIN SCREEN ================= */}
      {screen === "login" && (
        <div className="center">
          <h1>Welcome to EagleLift</h1>

          {/* Username input */}
          <input
            placeholder="Username"
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase())
            }
          />

          {/* Password input */}
          <input
            type="password"
            placeholder="Password"
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          {/* Login button */}
          <button onClick={login}>
            Login
          </button>

          {/* Go to register screen */}
          <button
            className="secondary"
            onClick={() => setScreen("register")}
          >
            Register
          </button>
        </div>
      )}

    </div>
  );
}

export default App;
