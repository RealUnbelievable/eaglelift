import { useState, useEffect } from "react";
import "./App.css";

// Firebase
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

// Gym data
import { gyms } from "./gymData";

type Schedule = { id: string; name: string };
type PlannerExercise = { id: string; name: string; reps: number; sets: number; timer: number };

function App() {
  const [screen, setScreen] = useState<"login" | "register" | "dashboard" | "planner">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  const [selectedGym, setSelectedGym] = useState(gyms[0]?.name || "");
  const [plannerExercises, setPlannerExercises] = useState<PlannerExercise[]>([]);

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSchedules = async () => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "schedules"), where("userId", "==", auth.currentUser.uid));
    const snapshot = await getDocs(q);
    const userSchedules: Schedule[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      userSchedules.push({ id: doc.id, name: data.name });
    });
    setSchedules(userSchedules);
  };

  const createSchedule = async () => {
    if (!auth.currentUser) return;
    const newName = `Workout Plan ${schedules.length + 1}`;
    await addDoc(collection(db, "schedules"), { userId: auth.currentUser.uid, name: newName });
    loadSchedules();
  };

  const deleteSchedule = async (id: string) => {
    if (!auth.currentUser) return;
    if (!window.confirm("Delete this schedule?")) return;
    await deleteDoc(doc(db, "schedules", id));
    if (selectedSchedule?.id === id) { setSelectedSchedule(null); setPlannerExercises([]); }
    loadSchedules();
  };

  const renameSchedule = async (id: string, newName: string) => {
    if (!auth.currentUser || !newName.trim()) return;
    await updateDoc(doc(db, "schedules", id), { name: newName.trim() });
    loadSchedules();
  };

  const register = async () => {
    try { await createUserWithEmailAndPassword(auth, username, password); setScreen("dashboard"); loadSchedules(); }
    catch (error) { alert("Registration failed: " + (error as Error).message); }
  };

  const login = async () => {
    try { await signInWithEmailAndPassword(auth, username, password); setScreen("dashboard"); loadSchedules(); }
    catch (error) { alert("Login failed: " + (error as Error).message); }
  };

  const addExercise = (name: string) => {
    if (plannerExercises.some((e) => e.name === name)) return;
    setPlannerExercises(prev => [...prev, { id: crypto.randomUUID(), name, reps: 10, sets: 3, timer: 0 }]);
  };

  const removeExercise = (name: string) => setPlannerExercises(prev => prev.filter((e) => e.name !== name));

  const currentGym = gyms.find((g) => g.name === selectedGym);
  const groupedExercises = currentGym?.exercises.reduce((acc: any, ex) => {
    if (!acc[ex.muscle]) acc[ex.muscle] = [];
    acc[ex.muscle].push(ex);
    return acc;
  }, {}) || {};

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
            <button
              onClick={createSchedule}>Create Schedule</button>
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

          {/* Schedule cards */}
          {schedules.map((schedule) => (
            <div key={schedule.id} className="schedule-card">
              <div className="schedule-name" onClick={() => {
                setSelectedSchedule(schedule);
                setScreen("planner"); // navigate to Planner page
              }}>
                {schedule.name}
              </div>
              <div className="card-actions">
                <span
                  className="edit-icon"
                  onClick={() => {
                    const newName = prompt("Enter new schedule name", schedule.name);
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

      {/* PLANNER PAGE */}
      {screen === "planner" && selectedSchedule && (
        <div className="planner-page">
          <div className="planner-header">
            <h1 className="planner-title">{selectedSchedule.name}</h1>
            <div className="planner-header-buttons">
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
              <button
                onClick={() => {
                  setSelectedSchedule(null);
                  setPlannerExercises([]);
                  setScreen("dashboard"); // go back to dashboard
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
                {gyms.map((gym) => <option key={gym.name} value={gym.name}>{gym.name}</option>)}
              </select>
              {Object.entries(groupedExercises).map(([muscle, exercises]: any) => (
                <div key={muscle}>
                  <h4>{muscle}</h4>
                  {exercises.map((exercise: any) => (
                    <label key={exercise.name}>
                      <input type="checkbox" checked={plannerExercises.some((e) => e.name === exercise.name)}
                             onChange={(e) => e.target.checked ? addExercise(exercise.name) : removeExercise(exercise.name)} />
                      {exercise.name}
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
                    <th>Exercise</th><th>Reps</th><th>Sets</th><th>Timer (sec)</th>
                  </tr>
                </thead>
                <tbody>
                  {plannerExercises.map((exercise) => (
                    <tr key={exercise.id}>
                      <td>{exercise.name}</td>
                      <td><input type="number" value={exercise.reps}
                                 onChange={(e) => setPlannerExercises(prev => prev.map(ex => ex.id === exercise.id ? {...ex, reps: +e.target.value} : ex))} /></td>
                      <td><input type="number" value={exercise.sets}
                                 onChange={(e) => setPlannerExercises(prev => prev.map(ex => ex.id === exercise.id ? {...ex, sets: +e.target.value} : ex))} /></td>
                      <td><input type="number" value={exercise.timer}
                                 onChange={(e) => setPlannerExercises(prev => prev.map(ex => ex.id === exercise.id ? {...ex, timer: +e.target.value} : ex))} /></td>
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