import { useState } from "react";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("home");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const register = () => {
    localStorage.setItem("gymUser", username);
    localStorage.setItem("gymPass", password);
    setScreen("dashboard");
  };

  const login = () => {
    const savedUser = localStorage.getItem("gymUser");
    const savedPass = localStorage.getItem("gymPass");

    if (username === savedUser && password === savedPass) {
      setScreen("dashboard");
    } else {
      alert("Invalid login");
    }
  };

  if (screen === "dashboard") {
    return (
      <div className="center">
        <h1>You’re signed in</h1>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div className="center">
        <h2>Register</h2>
        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={register}>Create Account</button>
        <button onClick={() => setScreen("home")}>Back</button>
      </div>
    );
  }

  return (
    <div>
      <div className="top-buttons">
        <button onClick={() => setScreen("home")}>Login</button>
        <button onClick={() => setScreen("register")}>Register</button>
      </div>

      <div className="center">
        <h1>Welcome to EagleLift</h1>

        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={login}>Sign In</button>
      </div>
    </div>
  );
}

export default App;
