import { useState, useEffect } from "react";
import "./App.css";

// Firebase
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { gyms } from "./gymData";

/* ================= TYPES ================= */

type Schedule = {
  id: string;
  name: string;
};

type PlannerExercise = {
  id: string;
  name: string;
  reps: number;
  sets: number;
  timer: number;
  isRunning: boolean;
};

/* ================= APP ================= */

function App() {
  const [screen, setScreen] = useState<"login" | "register" | "dashboard" | "planner">("login");

  const [user, setUser] = useState<User | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const [selectedGym, setSelectedGym] = useState(gyms[0]?.name || "");

  const [plannerExercises, setPlannerExercises] = useState<PlannerExercise[]>([]);
  const [customExercise, setCustomExercise] = useState("");

  const [time, setTime] = useState(new Date());

  /* ================= CLOCK ================= */
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ================= EXERCISE TIMER ================= */
  useEffect(() => {
    const interval = setInterval(() => {
      setPlannerExercises((prev) =>
        prev.map((ex) =>
          ex.isRunning && ex.timer > 0
            ? { ...ex, timer: ex.timer - 1 }
            : ex
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ================= AUTH LISTENER ================= */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setScreen("dashboard");
        loadSchedules(u.uid);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  /* ================= AUTH FUNCTIONS ================= */
  const register = async () => {
    try {
      await createUserWithEmailAndPassword(auth, username, password);
    } catch (error) {
      alert("Registration failed: " + (error as Error).message);
    }
  };

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, username, password);
    } catch (error) {
      alert("Login failed: " + (error as Error).message);
    }
  };

  /* ================= SCHEDULE FUNCTIONS ================= */
  const loadSchedules = async (uid: string) => {
    const q = query(collection(db, "schedules"), where("userId", "==", uid));
    const snapshot = await getDocs(q);

    const list: Schedule[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
    }));

    setSchedules(list);
  };

  const createSchedule = async () => {
    if (!user) {
      alert("Wait a second, user not ready");
      return;
    }

    try {
      await addDoc(collection(db, "schedules"), {
        userId: user.uid,
        name: `Workout Plan ${schedules.length + 1}`,
      });

      loadSchedules(user.uid);
    } catch (err) {
      console.error(err);
      alert("Failed to create schedule");
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Delete this schedule?")) return;

    await deleteDoc(doc(db, "schedules", id));

    if (selectedSchedule?.id === id) {
      setSelectedSchedule(null);
      setPlannerExercises([]);
    }

    loadSchedules(user.uid);
  };

  const renameSchedule = async (id: string, newName: string) => {
    if (!user || !newName.trim()) return;

    await updateDoc(doc(db, "schedules", id), { name: newName.trim() });
    loadSchedules(user.uid);
  };

  /* ================= EXERCISE FUNCTIONS ================= */
  const loadExercises = async (scheduleId: string) => {
    const snapshot = await getDocs(collection(db, "schedules", scheduleId, "exercises"));

    const loaded: PlannerExercise[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name,
        reps: data.reps,
        sets: data.sets,
        timer: data.timer || 60,
        isRunning: data.isRunning || false,
      };
    });

    setPlannerExercises(loaded);
  };

  const addExercise = async (name: string) => {
    if (!selectedSchedule) return;
    if (plannerExercises.some((e) => e.name === name)) return;

    const docRef = await addDoc(
      collection(db, "schedules", selectedSchedule.id, "exercises"),
      { id: crypto.randomUUID(), name, reps: 10, sets: 3, timer: 60, isRunning: false }
    );

    setPlannerExercises((prev) => [
      ...prev,
      { id: docRef.id, name, reps: 10, sets: 3, timer: 60, isRunning: false },
    ]);
  };

  const addCustomExercise = () => {
    if (!customExercise.trim()) return;
    addExercise(customExercise.trim());
    setCustomExercise("");
  };

  const removeExercise = async (name: string) => {
    if (!selectedSchedule) return;

    const ex = plannerExercises.find((e) => e.name === name);
    if (!ex) return;

    await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", ex.id));

    setPlannerExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  const updateExercise = async (
    id: string,
    field: keyof Omit<PlannerExercise, "id" | "name">,
    value: number
  ) => {
    if (!selectedSchedule) return;

    await updateDoc(doc(db, "schedules", selectedSchedule.id, "exercises", id), { [field]: value });

    setPlannerExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  /* ================= UI HELPERS ================= */
  const currentGym = gyms.find((g) => g.name === selectedGym);
  const groupedExercises =
    currentGym?.exercises.reduce((acc: any, ex) => {
      if (!acc[ex.muscle]) acc[ex.muscle] = [];
      acc[ex.muscle].push(ex);
      return acc;
    }, {}) || {};

  /* ================= UI ================= */
  return (
    <div className="app">
      {/* CLOCK */}
      <div className="clock">
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        <div className="date">{time.toLocaleDateString()}</div>
      </div>

      {/* LOGIN */}
      {screen === "login" && (
        <div className="login-screen">
          <h1>EagleLift</h1>
          <input placeholder="Email" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={login}>Login</button>
          <button onClick={() => setScreen("register")}>Register</button>
        </div>
      )}

      {/* REGISTER */}
      {screen === "register" && (
        <div className="login-screen">
          <h1>Register</h1>
          <input placeholder="Email" onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={register}>Create Account</button>
          <button onClick={() => setScreen("login")}>Back</button>
        </div>
      )}

      {/* DASHBOARD */}
      {screen === "dashboard" && (
        <div className="dashboard">
          <h1 className="dashboard-title">Schedule Plans</h1>
          <div className="dashboard-header-buttons">
            <button onClick={createSchedule}>Create Schedule</button>
            <button
              className="secondary logout-btn"
              onClick={() => {
                auth.signOut();
                setScreen("login");
                setSchedules([]);
                setSelectedSchedule(null);
                setPlannerExercises([]);
              }}
            >
              Log Out
            </button>
          </div>

          {schedules.map((schedule) => (
            <div key={schedule.id} className="schedule-card">
              <div
                onClick={() => {
                  setSelectedSchedule(schedule);
                  setScreen("planner");
                  loadExercises(schedule.id);
                }}
              >
                {schedule.name}
              </div>

              <div>
                <span
                  onClick={() => {
                    const newName = prompt("Rename", schedule.name);
                    if (newName) renameSchedule(schedule.id, newName);
                  }}
                >
                  ✎
                </span>

                <button onClick={() => deleteSchedule(schedule.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PLANNER */}
      {screen === "planner" && selectedSchedule && (
        <div className="planner-page">
          <div className="planner-header">
            <h1 className="planner-title">{selectedSchedule.name}</h1>
            <div className="planner-header-buttons">
              <button className="secondary logout-btn" onClick={() => auth.signOut()}>
                Log Out
              </button>

              <button
                onClick={() => {
                  setSelectedSchedule(null);
                  setPlannerExercises([]);
                  setScreen("dashboard");
                }}
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="planner-layout">
            <div className="planner-left">
              <h3>Select Gym</h3>

              <select value={selectedGym} onChange={(e) => setSelectedGym(e.target.value)}>
                {gyms.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>

              <div style={{ marginBottom: "12px" }}>
                <input
                  placeholder="Custom exercise..."
                  value={customExercise}
                  onChange={(e) => setCustomExercise(e.target.value)}
                />
                <button onClick={addCustomExercise} style={{ marginTop: "6px" }}>
                  Add
                </button>
              </div>

              {Object.entries(groupedExercises).map(([muscle, exercises]: any) => (
                <div key={muscle}>
                  <h4>{muscle}</h4>
                  {exercises.map((ex: any) => (
                    <label key={ex.name}>
                      <input
                        type="checkbox"
                        checked={plannerExercises.some((e) => e.name === ex.name)}
                        onChange={(e) =>
                          e.target.checked ? addExercise(ex.name) : removeExercise(ex.name)
                        }
                      />
                      {ex.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <div className="planner-right">
              <h3>Your Workout Plan</h3>

              <table className="planner-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Reps</th>
                    <th>Sets</th>
                    <th>Timer</th>
                  </tr>
                </thead>

                <tbody>
                  {plannerExercises.map((ex) => (
                    <tr key={ex.id}>
                      <td>{ex.name}</td>

                      <td>
                        <input
                          type="number"
                          value={ex.reps}
                          onChange={(e) => updateExercise(ex.id, "reps", Number(e.target.value))}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={(e) => updateExercise(ex.id, "sets", Number(e.target.value))}
                        />
                      </td>

                      <td>
                        <div>
                          {Math.floor(ex.timer / 60).toString().padStart(2, "0")}:
                          {(ex.timer % 60).toString().padStart(2, "0")}
                        </div>

                        <input
                          type="number"
                          value={ex.timer}
                          onChange={(e) =>
                            setPlannerExercises((prev) =>
                              prev.map((item) =>
                                item.id === ex.id ? { ...item, timer: +e.target.value } : item
                              )
                            )
                          }
                        />

                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <button
                            onClick={() =>
                              setPlannerExercises((prev) =>
                                prev.map((item) =>
                                  item.id === ex.id ? { ...item, isRunning: !item.isRunning } : item
                                )
                              )
                            }
                          >
                            {ex.isRunning ? "Stop" : "Start"}
                          </button>

                          <button
                            onClick={() =>
                              setPlannerExercises((prev) =>
                                prev.map((item) =>
                                  item.id === ex.id ? { ...item, timer: 0, isRunning: false } : item
                                )
                              )
                            }
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;