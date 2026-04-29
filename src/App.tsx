import { useState, useEffect, useRef } from "react";
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
    getDoc,
    setDoc
} from "firebase/firestore";

import { gyms, type GymExercise } from "./gymData";

import WorkoutTimer from "./WorkoutTimer";

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
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ================= PRE-COMPUTE MUSCLE MAP ================= */
// Create a quick lookup dictionary for exercise names -> muscles
const exerciseMuscleMap: Record<string, string[]> = {};
gyms.forEach((gym) => {
    gym.exercises.forEach((ex) => {
        const muscles = (ex as any).muscles ?? ((ex as any).muscle ? [(ex as any).muscle] : []);
        exerciseMuscleMap[ex.name] = muscles;
    });
});

/* ================= APP ================= */

function App() {
    const [screen, setScreen] = useState<"login" | "register" | "dashboard" | "planner" | "weekly">("login");

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

    // Error state for add actions
    const [addError, setAddError] = useState<string | null>(null);

    // Prevent double-firing on touch devices: track recent touch-add
    const touchAddRef = useRef(false);

    // --- WEEKLY PLAN STATE ---
    const [weeklyPlan, setWeeklyPlan] = useState<Record<string, string>>({});
    const [scheduleExercisesCache, setScheduleExercisesCache] = useState<Record<string, string[]>>({});

    /* ================= DATA LOADING FUNCTIONS ================= */

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

    const loadScheduleCache = async (scheduleId: string) => {
        // Prevent re-fetching if we already have it
        if (scheduleExercisesCache[scheduleId]) return;

        const snapshot = await getDocs(collection(db, "schedules", scheduleId, "exercises"));
        const names = snapshot.docs.map(d => d.data().name as string);

        setScheduleExercisesCache(prev => ({ ...prev, [scheduleId]: names }));
    };

    const loadWeeklyPlan = async (uid: string) => {
        const docRef = doc(db, "weekly_plans", uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const plan = snap.data() as Record<string, string>;
            setWeeklyPlan(plan);

            // Preload exercise caches for all assigned schedules to calculate muscles
            const assignedScheduleIds = Array.from(new Set(Object.values(plan).filter(id => id !== "")));
            assignedScheduleIds.forEach(id => loadScheduleCache(id));
        } else {
            setWeeklyPlan({ Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: "", Sunday: "" });
        }
    };

    /* ================= CLOCK ================= */
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    /* ================= EXERCISE TIMER ================= */

    /* ================= AUTH LISTENER ================= */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                setScreen("dashboard");
                loadSchedules(u.uid);
                loadWeeklyPlan(u.uid);
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

        // Optional: remove it from the weekly plan if deleted
        const updatedPlan = { ...weeklyPlan };
        let planChanged = false;
        Object.keys(updatedPlan).forEach(day => {
            if (updatedPlan[day] === id) {
                updatedPlan[day] = "";
                planChanged = true;
            }
        });

        if (planChanged) {
            setWeeklyPlan(updatedPlan);
            await setDoc(doc(db, "weekly_plans", user.uid), updatedPlan, { merge: true });
        }

        loadSchedules(user.uid);
    };

    const renameSchedule = async (id: string, newName: string) => {
        if (!user || !newName.trim()) return;

        await updateDoc(doc(db, "schedules", id), { name: newName.trim() });
        loadSchedules(user.uid);
    };

    const updateWeeklyDay = async (day: string, scheduleId: string) => {
        if (!user) return;

        const newPlan = { ...weeklyPlan, [day]: scheduleId };
        setWeeklyPlan(newPlan);

        await setDoc(doc(db, "weekly_plans", user.uid), newPlan, { merge: true });

        // Ensure we have the exercises cached for the newly selected schedule
        if (scheduleId) loadScheduleCache(scheduleId);
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
                timer: data.timer ?? 60
            };
        });

        setPlannerExercises(loaded);

        // Update cache while we're here
        setScheduleExercisesCache(prev => ({
            ...prev,
            [scheduleId]: loaded.map(ex => ex.name)
        }));
    };

    const addExercise = async (name: string) => {
        if (!selectedSchedule) return;

        try {
            const docRef = await addDoc(
                collection(db, "schedules", selectedSchedule.id, "exercises"),
                { name, reps: 10, sets: 3, timer: 60 }
            );

            const newEx = { id: docRef.id, name, reps: 10, sets: 3, timer: 60 };

            setPlannerExercises((prev) => [...prev, newEx]);

            // Update Cache
            setScheduleExercisesCache(prev => ({
                ...prev,
                [selectedSchedule.id]: [...(prev[selectedSchedule.id] || []), name]
            }));
        } catch (err) {
            console.error("Failed to add exercise:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setAddError("Failed to add workout. " + msg + " (Try again or check your network.)");
            setTimeout(() => setAddError(null), 6000);
            throw err;
        }
    };

    const addCustomExercise = async () => {
        if (!customExercise.trim()) return;
        try {
            await addExercise(customExercise.trim());
            setCustomExercise("");
        } catch { /* empty */ }
    };

    const removeExercise = async (name: string) => {
        if (!selectedSchedule) return;

        const ex = plannerExercises.find((e) => e.name === name);
        if (!ex) return;

        await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", ex.id));

        setPlannerExercises((prev) => prev.filter((e) => e.id !== ex.id));

        // Update Cache
        setScheduleExercisesCache(prev => {
            const currentCache = prev[selectedSchedule.id] || [];
            const index = currentCache.indexOf(name);
            if (index > -1) {
                const newCache = [...currentCache];
                newCache.splice(index, 1);
                return { ...prev, [selectedSchedule.id]: newCache };
            }
            return prev;
        });
    };

    const removeExerciseById = async (id: string) => {
        if (!selectedSchedule) return;
        if (!window.confirm("Remove this workout instance from the schedule?")) return;

        try {
            const exToRemove = plannerExercises.find(e => e.id === id);
            await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", id));

            setPlannerExercises((prev) => prev.filter((e) => e.id !== id));

            // Update Cache
            if (exToRemove) {
                setScheduleExercisesCache(prev => {
                    const currentCache = prev[selectedSchedule.id] || [];
                    const index = currentCache.indexOf(exToRemove.name);
                    if (index > -1) {
                        const newCache = [...currentCache];
                        newCache.splice(index, 1);
                        return { ...prev, [selectedSchedule.id]: newCache };
                    }
                    return prev;
                });
            }
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

        // Prevent negative values for reps, sets, and timer
        if ((field === "reps" || field === "sets" || field === "timer") && value < 0) {
            return;
        }

        await updateDoc(doc(db, "schedules", selectedSchedule.id, "exercises", id), { [field]: value });

        setPlannerExercises((prev) =>
            prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
        );
    };

    /* ================= WEEKLY MUSCLE LOGIC ================= */
    const getWeeklyMusclesHit = () => {
        const muscleTally: Record<string, number> = {};

        // Loop through each day of the week
        Object.values(weeklyPlan).forEach(scheduleId => {
            if (!scheduleId) return;

            // Find which muscles are hit ON THIS SPECIFIC DAY
            const musclesHitToday = new Set<string>();
            const exerciseNames = scheduleExercisesCache[scheduleId] || [];

            exerciseNames.forEach(name => {
                const muscles = exerciseMuscleMap[name] || [];
                muscles.forEach(m => musclesHitToday.add(m));
            });

            // Add today's unique muscles to the total weekly tally
            musclesHitToday.forEach(m => {
                muscleTally[m] = (muscleTally[m] || 0) + 1;
            });
        });

        // Convert to an array of [muscle, count] and sort alphabetically
        return Object.entries(muscleTally).sort((a, b) => a[0].localeCompare(b[0]));
    };

    /* ================= UI HELPERS ================= */
    const currentGym = gyms.find((g) => g.name === selectedGym);
    const allExercises: GymExercise[] = currentGym?.exercises ?? [];

    const allMusclesSet = new Set<string>();
    allExercises.forEach((ex) => {
        const muscles = (ex as any).muscles ?? ((ex as any).muscle ? [(ex as any).muscle] : []);
        muscles.forEach((m: string) => {
            if (m && typeof m === "string") allMusclesSet.add(m);
        });
    });
    const allMuscles = Array.from(allMusclesSet).sort((a, b) => a.localeCompare(b));

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

    /* ================= Touch/click handlers ================= */
    const handleAddTouchEnd = async (name: string, e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        touchAddRef.current = true;
        try { await addExercise(name); }
        finally { setTimeout(() => { touchAddRef.current = false; }, 700); }
    };

    const handleAddClick = async (name: string, e: React.MouseEvent) => {
        if (touchAddRef.current) { e.stopPropagation(); return; }
        try { await addExercise(name); } catch { /* empty */ }
    };

    const handleCustomAddTouchEnd = async (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        touchAddRef.current = true;
        try { await addCustomExercise(); }
        finally { setTimeout(() => { touchAddRef.current = false; }, 700); }
    };

    const handleCustomAddClick = async (e: React.MouseEvent) => {
        if (touchAddRef.current) { e.stopPropagation(); return; }
        try { await addCustomExercise(); } catch { /* empty */ }
    };

    /* ================= UI ================= */
    return (
        <div className="app">
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h1 style={{ margin: 0, color: "var(--color-muted)" }}>Dashboard</h1>
                        <button
                            onClick={() => setScreen("weekly")}
                            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-contrast)" }}>
                            📅 Weekly Planner
                        </button>
                    </div>

                    <div className="dashboard-header-buttons" style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                        <button onClick={createSchedule}>Create Schedule</button>
                        <button
                            className="secondary logout-btn"
                            onClick={() => {
                                auth.signOut();
                                setScreen("login");
                                setSchedules([]);
                                setSelectedSchedule(null);
                                setPlannerExercises([]);
                                setWeeklyPlan({});
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

            {/* WEEKLY PLANNER */}
            {screen === "weekly" && (
                <div className="planner-page">
                    <div className="planner-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h1 className="planner-title">Weekly Overview</h1>
                        <button onClick={() => setScreen("dashboard")}>← Back to Dashboard</button>
                    </div>

                    <div className="planner-layout">
                        {/* Left Side: Days Selection */}
                        <div className="planner-left">
                            <h3>Assign Workouts</h3>
                            <p style={{ color: "var(--color-muted)", fontSize: "14px", marginBottom: "16px" }}>
                                Select a schedule for each day to view your targeted muscles for the week.
                            </p>

                            {DAYS_OF_WEEK.map(day => (
                                <div key={day} className="day-row">
                                    <label className="day-label">{day}</label>
                                    <select
                                        className="day-select"
                                        value={weeklyPlan[day] || ""}
                                        onChange={(e) => updateWeeklyDay(day, e.target.value)}
                                    >
                                        <option value="">Rest Day</option>
                                        {schedules.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* Right Side: Muscles Targeted summary */}
                        <div className="planner-right">
                            <h3>Weekly Muscles Targeted</h3>
                            <p style={{ color: "var(--color-muted)", fontSize: "14px", marginBottom: "16px" }}>
                                Aim to hit each muscle group at least 2x a week.
                            </p>

                            <div className="filter-panel" style={{ border: "none", gap: "10px", marginTop: "16px" }}>
                                {getWeeklyMusclesHit().length === 0 ? (
                                    <p className="no-results" style={{ width: "100%", textAlign: "left" }}>
                                        No muscles targeted yet. Assign schedules to your week to see your summary!
                                    </p>
                                ) : (
                                    getWeeklyMusclesHit().map(([m, count]) => {
                                        // Highlight the chip in Gold if they hit the 2x/week goal
                                        const metGoal = count >= 2;

                                        return (
                                            <span
                                                key={m as string}
                                                className={`muscle-chip ${metGoal ? 'selected' : ''}`}
                                                style={{
                                                    cursor: "default",
                                                    transform: "none",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "8px"
                                                }}
                                            >
                                                {m as string}
                                                <span style={{
                                                    background: metGoal ? "rgba(0,0,0,0.15)" : "rgba(11,61,145,0.08)",
                                                    padding: "2px 8px",
                                                    borderRadius: "10px",
                                                    fontSize: "12px",
                                                    fontWeight: "bold",
                                                    color: metGoal ? "var(--color-primary-contrast)" : "var(--color-accent)"
                                                }}>
                                                    {count}x
                                                </span>
                                            </span>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PLANNER (Existing specific schedule view) */}
            {screen === "planner" && selectedSchedule && (
                <div className="planner-page">
                    <div className="planner-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h1 className="planner-title">{selectedSchedule.name}</h1>
                        <div className="planner-header-buttons" style={{ display: "flex", gap: "10px" }}>
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
                            {addError && (
                                <div className="error-banner" role="alert">
                                    <div>{addError}</div>
                                    <button className="dismiss" onClick={() => setAddError(null)} aria-label="Dismiss error">✕</button>
                                </div>
                            )}

                            <h3>Select Gym</h3>
                            <select value={selectedGym} onChange={(e) => setSelectedGym((e.target as HTMLSelectElement).value)} style={{ width: "100%", marginBottom: "12px" }}>
                                {gyms.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
                            </select>

                            <div style={{ marginBottom: "12px" }}>
                                <input
                                    placeholder="Custom exercise..."
                                    value={customExercise}
                                    onChange={(e) => setCustomExercise((e.target as HTMLInputElement).value)}
                                />
                                <button onTouchEnd={handleCustomAddTouchEnd} onClick={handleCustomAddClick} style={{ marginTop: "6px" }}>
                                    Add
                                </button>
                            </div>

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
                                                <button key={m} className={`muscle-chip ${selected ? "selected" : ""}`} type="button" onClick={() => toggleFilter(m)}>
                                                    {m}
                                                </button>
                                            );
                                        })}
                                        <div style={{ marginTop: 8 }}>
                                            <button type="button" className="secondary" onClick={() => { setSelectedFilters([]); setFilterOpen(false); }}>Clear</button>
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
                                                    <button type="button" onTouchEnd={(e) => handleAddTouchEnd(ex.name, e)} onClick={(e) => handleAddClick(ex.name, e)}>
                                                        Add
                                                    </button>
                                                    {count > 0 && (
                                                        <button type="button" className="secondary" onClick={() => removeExercise(ex.name)}>Delete</button>
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
                                                <input type="number" value={ex.reps} onChange={(e) => { const val = Number((e.target as HTMLInputElement).value); if (val >= 0) updateExercise(ex.id, "reps", val); }} />
                                            </td>
                                            <td>
                                                <input type="number" value={ex.sets} onChange={(e) => { const val = Number((e.target as HTMLInputElement).value); if (val >= 0) updateExercise(ex.id, "sets", val); }} />
                                            </td>
                                            <td style={{ minWidth: 220 }}>
                                                <WorkoutTimer
                                                    exerciseId={ex.id}
                                                    exerciseName={ex.name}
                                                    sets={ex.sets}
                                                    workSeconds={ex.timer}
                                                    onWorkSecondsChange={(val) =>
                                                        updateExercise(ex.id, "timer", val)
                                                    }
                                                />
                                                <div style={{ marginTop: 8 }}>
                                                    <button
                                                        className="secondary"
                                                        onClick={() => removeExerciseById(ex.id)}
                                                        aria-label="Delete exercise"
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