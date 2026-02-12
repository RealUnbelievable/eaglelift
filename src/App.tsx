//Firebase authentication
import { auth } from "./firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";


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

    // Workout Schedule State
    // stores schedules as a string for now
    const [schedules, setSchedules] = useState<string[]>([]);

    // create schedule function
    const createSchedule = () => {
        const newScheduleName = `Workout Plan ${schedules.length + 1}`;
        setSchedules([...schedules, newScheduleName]);
    };


  /* =========================
     REGISTER FUNCTION
     ========================= */

    const register = async () => {
        if (!username || !password) {
            alert("Fill in all fields");
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, username, password);
            setScreen("dashboard");
        } catch (error) {
            if (error instanceof Error) {
                alert(error.message);
            } else {
                alert("Registration failed");
            }
        }
    };


  /* =========================
     LOGIN FUNCTION
     ========================= */

    const login = async () => {
        try {
            await signInWithEmailAndPassword(auth, username, password);
            setScreen("dashboard");
        } catch (error) {
            if (error instanceof Error) {
                alert(error.message);
            } else {
                alert("Invalid login");
            }
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
       })}
        <div className = "date">
          {time.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric"})}
        </div>
      </div>

      {/* ================= DASHBOARD SCREEN ================= */}
          {screen === "dashboard" && (
              <div className="center">
                  <h1>Your Workout Schedules</h1>

                  {schedules.length === 0 ? (
                      <>
                          <p>No schedules created yet.</p>
                          <button onClick={createSchedule}>
                              Create Workout Schedule
                          </button>
                      </>
                  ) : (
                      <>
                          <ul>
                              {schedules.map((schedule, index) => (
                                  <li key={index}>{schedule}</li>
                              ))}
                          </ul>

                          <button onClick={createSchedule}>
                              Add Another Schedule
                          </button>
                      </>
                  )}
              </div>
          )}


      {/* ================= REGISTER SCREEN ================= */}
      {screen === "register" && (
        <div className="center">
          <h1>Register</h1>

          {/* Username input */}
          <input
            placeholder="Email"
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
            placeholder="Email"
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
