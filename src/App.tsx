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

import { gyms, type GymExercise } from "./gymData";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const [time, setTime] = useState(new Date());

  /* ================= SCHEDULE FUNCTIONS ================= */
  // Hoisted function declaration so it can be called from useEffect above without TDZ / no-use-before-define
  async function loadSchedules(uid: string) {
    const q = query(collection(db, "schedules"), where("userId", "==", uid));
    const snapshot = await getDocs(q);

    const list: Schedule[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as { name?: string };
      return {
        id: docSnap.id,
        name: data.name ?? "Unnamed",
      };
    });

    setSchedules(list);
  }

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
          ex.isRunning && ex.timer > 0 ? { ...ex, timer: ex.timer - 1 } : ex
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
      const data = docSnap.data() as Partial<PlannerExercise>;
      return {
        id: docSnap.id,
        name: data.name ?? "Unnamed",
        reps: data.reps ?? 10,
        sets: data.sets ?? 3,
        timer: data.timer ?? 60,
        isRunning: data.isRunning ?? false,
      };
    });

    setPlannerExercises(loaded);
  };

  const addExercise = async (name: string) => {
    if (!selectedSchedule) return;

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

  // Delete a single instance of the named exercise (first match)
  const removeExercise = async (name: string) => {
    if (!selectedSchedule) return;

    const ex = plannerExercises.find((e) => e.name === name);
    if (!ex) return;

    await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", ex.id));

    setPlannerExercises((prev) => prev.filter((e) => e.id !== ex.id));
  };

  // Delete a specific instance by id
  const removeExerciseById = async (id: string) => {
    if (!selectedSchedule) return;
    if (!window.confirm("Remove this workout instance from the schedule?")) return;

    try {
      await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", id));
      setPlannerExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to remove exercise:", err);
      alert("Failed to remove exercise.");
    }
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
  const allExercises: GymExercise[] = currentGym?.exercises ?? [];

  // collect unique muscles (handles legacy `muscle` and `muscles` array)
  const allMusclesSet = new Set<string>();
  allExercises.forEach((ex) => {
    const muscles = (ex as any).muscles ?? ((ex as any).muscle ? [(ex as any).muscle] : []);
    muscles.forEach((m: string) => {
      if (m && typeof m === "string") allMusclesSet.add(m);
    });
  });
  const allMuscles = Array.from(allMusclesSet).sort((a, b) => a.localeCompare(b));

  // filter + sort exercises: search, then muscle filter if any, then alphabetical
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const displayedExercises = allExercises
    .filter((ex) => {
      if (normalizedQuery) {
        if (!ex.name.toLowerCase().includes(normalizedQuery)) return false;
      }
      if (selectedFilters.length > 0) {
        const muscles = (ex as any).muscles ?? ((ex as any).muscle ? [(ex as any).muscle] : []);
        const match = muscles.some((m: string) => selectedFilters.includes(m));
        return match;
      }
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleFilter = (muscle: string) => {
    setSelectedFilters((prev) => (prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]));
  };

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
          <input placeholder="Email" onChange={(e) => setUsername((e.target as HTMLInputElement).value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword((e.target as HTMLInputElement).value)} />
          <button onClick={login}>Login</button>
          <button onClick={() => setScreen("register")}>Register</button>
        </div>
      )}

      {/* REGISTER */}
      {screen === "register" && (
        <div className="login-screen">
          <h1>Register</h1>
          <input placeholder="Email" onChange={(e) => setUsername((e.target as HTMLInputElement).value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword((e.target as HTMLInputElement).value)} />
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
            <div
              key={schedule.id}
              className="schedule-card"
              onClick={() => {
                setSelectedSchedule(schedule);
                setScreen("planner");
                loadExercises(schedule.id);
              }}
            >
              <div className="schedule-name">{schedule.name}</div>

              <div className="schedule-actions">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt("Rename", schedule.name);
                    if (newName) renameSchedule(schedule.id, newName);
                  }}
                >
                  ✎
                </span>

                <button onClick={(e) => { e.stopPropagation(); deleteSchedule(schedule.id); }}>🗑</button>
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

              <select value={selectedGym} onChange={(e) => setSelectedGym((e.target as HTMLSelectElement).value)}>
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
                  onChange={(e) => setCustomExercise((e.target as HTMLInputElement).value)}
                />
                <button onClick={addCustomExercise} style={{ marginTop: "6px" }}>Add</button>
              </div>

              {/* Exercise box with search, filter and scroll */}
              <div className="exercise-box">
                <div className="filter-row">
                  <input
                    className="exercise-search"
                    placeholder="Search workouts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  />
                  <button className="filter-btn" onClick={() => setFilterOpen((s) => !s)}>
                    Filter {selectedFilters.length > 0 ? `(${selectedFilters.length})` : ""}
                  </button>
                </div>

                {filterOpen && (
                  <div className="filter-panel">
                    {allMuscles.map((m) => {
                      const selected = selectedFilters.includes(m);
                      return (
                        <button
                          key={m}
                          className={`muscle-chip ${selected ? "selected" : ""}`}
                          type="button"
                          onClick={() => toggleFilter(m)}
                        >
                          {m}
                        </button>
                      );
                    })}
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="secondary" onClick={() => { setSelectedFilters([]); setFilterOpen(false); }}>
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div className="exercise-list">
                  {displayedExercises.map((ex) => {
                    const count = plannerExercises.filter((p) => p.name === ex.name).length;
                    return (
                      <div className="exercise-tile" key={ex.name}>
                        <div className="exercise-info">
                          <div className="exercise-name">{ex.name}</div>
                          {count > 0 && <div className="exercise-count">{count}</div>}
                        </div>

                        <div className="exercise-actions">
                          <button type="button" onClick={() => addExercise(ex.name)}>Add</button>
                          {count > 0 && (
                            <button type="button" className="secondary" onClick={() => removeExercise(ex.name)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {displayedExercises.length === 0 && <div className="no-results">No workouts found.</div>}
                </div>
              </div>
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
                          onChange={(e) => updateExercise(ex.id, "reps", Number((e.target as HTMLInputElement).value))}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={(e) => updateExercise(ex.id, "sets", Number((e.target as HTMLInputElement).value))}
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
                                item.id === ex.id ? { ...item, timer: +((e.target as HTMLInputElement).value) } : item
                              )
                            )
                          }
                        />

                        <div style={{ display: "flex", gap: "6px", marginTop: "4px", alignItems: "center" }}>
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

                          {/* Delete single instance button */}
                          <button
                            className="secondary"
                            onClick={() => removeExerciseById(ex.id)}
                            style={{ marginLeft: 0 }}
                          >
                            🗑
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