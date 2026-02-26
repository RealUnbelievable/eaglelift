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

// Firestore import
import { db } from "./firebase";
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    deleteDoc,
    doc,
    updateDoc
} from "firebase/firestore";




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

    // schedule selection states
    const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
   
    // Edit Schedule State
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [newScheduleName, setNewScheduleName] = useState("");


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
    type Schedule = {
        id: string;
        name: string;
    };

    const [schedules, setSchedules] = useState<Schedule[]>([]);


    // Load Schedules method
    const loadSchedules = async () => {
        if (!auth.currentUser) return;

        const q = query(
            collection(db, "schedules"),
            where("userId", "==", auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);

        const userSchedules: Schedule[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            userSchedules.push({
                id: doc.id,
                name: data.name,
            });
        });


        setSchedules(userSchedules);
    };

    const deleteSchedule = async (scheduleId: string) => {
        if (!auth.currentUser) return;

        const confirmDelete = window.confirm(
            "Are you sure you want to delete this schedule?"
        );

        if (!confirmDelete) return;

        try {
            await deleteDoc(doc(db, "schedules", scheduleId));

            // If the deleted schedule was selected, reset view
            if (selectedSchedule === scheduleId) {
                setSelectedSchedule(null);
            }

            // Refresh schedules list
            await loadSchedules();

        } catch (error) {
            console.error("Failed to delete schedule:", error);
        }
    };

    // Edit schedule feature
    const renameSchedule = async (scheduleId: string) => {
        if (!auth.currentUser) return;

        if (!newScheduleName.trim()) {
            alert("Schedule name cannot be empty.");
            return;
        }

        try {
            await updateDoc(doc(db, "schedules", scheduleId), {
                name: newScheduleName.trim(),
            });

            setEditingScheduleId(null);
            setNewScheduleName("");
            await loadSchedules();

        } catch (error) {
            console.error("Error renaming schedule:", error);
        }
    };


    // create schedule function
    const createSchedule = async () => {
        if (!auth.currentUser) return;

        const newScheduleName = `Workout Plan ${schedules.length + 1}`;

        try {
            await addDoc(collection(db, "schedules"), {
                userId: auth.currentUser.uid,
                name: newScheduleName
            });

            loadSchedules(); // refresh after adding
        } catch (error) {
            console.error("Error adding schedule:", error);
        }
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
            await loadSchedules();
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
            await loadSchedules();
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
              <div className="dashboard">
                  <div className="dashboard-content">

                      {/* ===== If NO schedule selected ===== */}
                      {!selectedSchedule && (
                          <>
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
                                      <div className="schedule-list">
                                              {schedules.map((schedule) => (
                                                  <div
                                                      key={schedule.id}
                                                      className="schedule-card"
                                                  >
                                                      {editingScheduleId === schedule.id ? (
                                                          <>
                                                              <input
                                                                  value={newScheduleName}
                                                                  onChange={(e) => setNewScheduleName(e.target.value)}
                                                                  placeholder="New schedule name"
                                                              />

                                                              <button
                                                                  onClick={() => renameSchedule(schedule.id)}
                                                              >
                                                                  Save
                                                              </button>

                                                              <button
                                                                  className="secondary"
                                                                  onClick={() => {
                                                                      setEditingScheduleId(null);
                                                                      setNewScheduleName("");
                                                                  }}
                                                              >
                                                                  Cancel
                                                              </button>
                                                          </>
                                                      ) : (
                                                          <>
                                                              <div onClick={() => setSelectedSchedule(schedule.id)}>
                                                                  {schedule.name}
                                                              </div>

                                                              <button
                                                                  className="secondary"
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setEditingScheduleId(schedule.id);
                                                                      setNewScheduleName(schedule.name);
                                                                  }}
                                                              >
                                                                  Rename
                                                              </button>

                                                              <button
                                                                  className="secondary"
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      deleteSchedule(schedule.id);
                                                                  }}
                                                              >
                                                                  Delete
                                                              </button>
                                                          </>
                                                      )}
                                                  </div>
                                              ))}
                                      </div>

                                      <button onClick={createSchedule}>
                                          Add Another Schedule
                                      </button>
                                  </>
                              )}
                          </>
                      )}

                      {/* ===== If A Schedule IS Selected ===== */}
                      {selectedSchedule && (
                          <div className="schedule-detail">
                              <h2>Schedule Details</h2>

                              <p>Schedule ID: {selectedSchedule}</p>

                              <button
                                  className="secondary"
                                  onClick={() => setSelectedSchedule(null)}
                              >
                                  Back to Schedules
                              </button>
                          </div>
                      )}

                  </div>
              </div>
          )}


      {/* ================= REGISTER SCREEN ================= */}
          {screen === "register" && (
              <div className="login-screen">
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
                  </div>
       
      )}

      {/* ================= LOGIN SCREEN ================= */}
      {screen === "login" && (
        <div className="login-screen">
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
        </div>
      )}

    </div>
  );
}

export default App;
