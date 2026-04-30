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
    muscle?: string;
};

// Extended type to resolve 'any' warnings from potentially varying gymData formats
type ExtendedExercise = GymExercise & {
    muscles?: string[];
    muscle?: string;
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// A guaranteed clean starting state for the planner
const defaultPlan: Record<string, string> = {
    Monday: "", Tuesday: "", Wednesday: "", Thursday: "", Friday: "", Saturday: "", Sunday: ""
};

/* ================= PRE-COMPUTE MUSCLE MAP ================= */
// Create a quick lookup dictionary for exercise names -> muscles
const exerciseMuscleMap: Record<string, string[]> = {};
gyms.forEach((gym) => {
    gym.exercises.forEach((ex) => {
        const extEx = ex as ExtendedExercise;
        const muscles = extEx.muscles ?? (extEx.muscle ? [extEx.muscle] : []);
        exerciseMuscleMap[extEx.name] = muscles;
    });
});

// A complete list of all distinct muscles across all gyms for the custom dropdown
const globalMuscles = Array.from(
    new Set(Object.values(exerciseMuscleMap).flat())
).sort((a, b) => a.localeCompare(b));

/* ================= APP ================= */

function App() {
    const [screen, setScreen] = useState<"login" | "register" | "welcome" | "dashboard" | "planner" | "weekly">("login");

    const [user, setUser] = useState<User | null>(null);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

    const [selectedGym, setSelectedGym] = useState(gyms[0]?.name || "");

    const [plannerExercises, setPlannerExercises] = useState<PlannerExercise[]>([]);
    const [customExercise, setCustomExercise] = useState("");
    const [customMuscle, setCustomMuscle] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

    const [time, setTime] = useState(new Date());

    const [addError, setAddError] = useState<string | null>(null);
    const touchAddRef = useRef(false);

    // Tracks if the user JUST created their account so we can show the welcome screen
    const isNewUserRef = useRef(false);

    // --- WEEKLY PLAN STATE ---
    const [weeklyPlan, setWeeklyPlan] = useState<Record<string, string>>(defaultPlan);
    const [scheduleExercisesCache, setScheduleExercisesCache] = useState<Record<string, { name: string, muscle?: string }[]>>({});

    /* ================= DATA LOADING FUNCTIONS ================= */

    async function loadSchedules(uid: string) {
        const q = query(collection(db, "schedules"), where("userId", "==", uid));
        const snapshot = await getDocs(q);

        const list: Schedule[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: (data.name as string) || "Unnamed",
            };
        });

        setSchedules(list);
    }

    const loadScheduleCache = async (scheduleId: string) => {
        if (scheduleExercisesCache[scheduleId]) return;

        const snapshot = await getDocs(collection(db, "schedules", scheduleId, "exercises"));
        const exercisesData = snapshot.docs.map(d => ({
            name: (d.data().name as string) || "Unnamed",
            muscle: (d.data().muscle as string) || undefined
        }));

        setScheduleExercisesCache(prev => ({ ...prev, [scheduleId]: exercisesData }));
    };

    const loadWeeklyPlan = async (uid: string) => {
        try {
            const docRef = doc(db, "weekly_plans", uid);
            const snap = await getDoc(docRef);

            const fullPlan: Record<string, string> = { ...defaultPlan };

            if (snap.exists()) {
                const planData = snap.data();
                // Strictly hydrate only valid string entries
                DAYS_OF_WEEK.forEach(day => {
                    if (typeof planData[day] === "string") {
                        fullPlan[day] = planData[day];
                    }
                });
            }

            setWeeklyPlan(fullPlan);

            // Preload caches
            const assignedScheduleIds = Array.from(new Set(Object.values(fullPlan).filter(id => id !== "")));
            assignedScheduleIds.forEach(id => loadScheduleCache(id));
        } catch (err) {
            console.error("Failed to load weekly plan:", err);
            setWeeklyPlan(defaultPlan);
        }
    };

    /* ================= CLOCK ================= */
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    /* ================= AUTH LISTENER ================= */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);

                // Show Welcome screen if they just registered, otherwise go straight to dashboard
                if (isNewUserRef.current) {
                    setScreen("welcome");
                    isNewUserRef.current = false; // Reset it
                } else {
                    setScreen("dashboard");
                }

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
            isNewUserRef.current = true; // Flag them as a new user
            await createUserWithEmailAndPassword(auth, username, password);
        } catch (error) {
            isNewUserRef.current = false;
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
            alert("User not ready");
            return;
        }

        if (schedules.length >= 15) {
            alert("Limit reached: You can only have up to 15 schedules.");
            return;
        }

        const namePrompt = prompt("Enter a name for your new schedule:", `Workout Plan ${schedules.length + 1}`);
        if (namePrompt === null) return;

        const trimmedName = namePrompt.trim();
        if (!trimmedName) {
            alert("Schedule name cannot be empty.");
            return;
        }

        if (trimmedName.length > 30) {
            alert("Schedule name must be 30 characters or less.");
            return;
        }

        try {
            await addDoc(collection(db, "schedules"), {
                userId: user.uid,
                name: trimmedName,
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

        // Clean out from weekly plan and sync safely
        let planChanged = false;
        const cleanPlan: Record<string, string> = { ...defaultPlan };

        DAYS_OF_WEEK.forEach(day => {
            if (weeklyPlan[day] === id) {
                cleanPlan[day] = "";
                planChanged = true;
            } else {
                cleanPlan[day] = weeklyPlan[day] || "";
            }
        });

        if (planChanged) {
            setWeeklyPlan(cleanPlan);
            try {
                // Save fully cleaned object
                await setDoc(doc(db, "weekly_plans", user.uid), cleanPlan);
            } catch (err) {
                console.error("Failed to update weekly plan after deletion", err);
            }
        }

        loadSchedules(user.uid);
    };

    const renameSchedule = async (id: string, newName: string) => {
        if (!user) return;
        const trimmed = newName.trim();
        if (!trimmed) {
            alert("Schedule name cannot be empty.");
            return;
        }
        if (trimmed.length > 30) {
            alert("Schedule name must be 30 characters or less.");
            return;
        }
        await updateDoc(doc(db, "schedules", id), { name: trimmed });
        loadSchedules(user.uid);
    };

    const updateWeeklyDay = async (day: string, scheduleId: string) => {
        if (!user) return;

        // Force rigorous sanitization of the weekly plan to prevent undefined values
        const cleanPlan: Record<string, string> = { ...defaultPlan };
        DAYS_OF_WEEK.forEach(d => {
            cleanPlan[d] = (typeof weeklyPlan[d] === "string" && weeklyPlan[d]) ? weeklyPlan[d] : "";
        });

        // Set the new schedule for the selected day
        cleanPlan[day] = typeof scheduleId === "string" ? scheduleId : "";

        setWeeklyPlan(cleanPlan);

        try {
            // Overwrite the entire document safely
            await setDoc(doc(db, "weekly_plans", user.uid), cleanPlan);
        } catch (error) {
            console.error("Firebase Weekly Planner Error:", error);
            alert("Failed to save weekly planner. Please check your connection.");
        }

        if (scheduleId) loadScheduleCache(scheduleId);
    };

    /* ================= EXERCISE FUNCTIONS ================= */
    const loadExercises = async (scheduleId: string) => {
        const snapshot = await getDocs(collection(db, "schedules", scheduleId, "exercises"));

        const loaded: PlannerExercise[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                name: (data.name as string) || "Unnamed",
                reps: typeof data.reps === "number" ? data.reps : 10,
                sets: typeof data.sets === "number" ? data.sets : 3,
                timer: typeof data.timer === "number" ? data.timer : 60,
                muscle: (data.muscle as string) || undefined,
            };
        });

        setPlannerExercises(loaded);

        setScheduleExercisesCache(prev => ({
            ...prev,
            [scheduleId]: loaded.map(ex => ({ name: ex.name, muscle: ex.muscle }))
        }));
    };

    const addExercise = async (name: string, muscle?: string) => {
        if (!selectedSchedule) return;

        if (plannerExercises.length >= 15) {
            alert("Limit reached: You can only have up to 15 workouts per schedule.");
            return;
        }

        try {
            // Strictly define payload without relying on conditional spreads
            const exerciseData: Record<string, any> = {
                name: name || "Unnamed",
                reps: 10,
                sets: 3,
                timer: 60
            };

            // Only attach muscle if it is a valid truthy string
            if (typeof muscle === "string" && muscle.trim() !== "") {
                exerciseData.muscle = muscle;
            }

            const docRef = await addDoc(
                collection(db, "schedules", selectedSchedule.id, "exercises"),
                exerciseData
            );

            const newEx: PlannerExercise = {
                id: docRef.id,
                name: exerciseData.name,
                reps: exerciseData.reps,
                sets: exerciseData.sets,
                timer: exerciseData.timer,
                muscle: exerciseData.muscle
            };

            setPlannerExercises((prev) => [...prev, newEx]);

            setScheduleExercisesCache(prev => ({
                ...prev,
                [selectedSchedule.id]: [...(prev[selectedSchedule.id] || []), { name: exerciseData.name, muscle: exerciseData.muscle }]
            }));
        } catch (err) {
            console.error("Firebase Exercise Add Error:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setAddError("Failed to add workout: " + msg);
            setTimeout(() => setAddError(null), 6000);
        }
    };

    const addCustomExercise = async () => {
        const name = customExercise.trim();
        if (!name) return;

        if (name.length > 30) {
            alert("Workout name must be 30 characters or less.");
            return;
        }

        try {
            await addExercise(name, customMuscle || undefined);
            setCustomExercise("");
            setCustomMuscle("");
        } catch { /* empty */ }
    };

    const removeExercise = async (name: string) => {
        if (!selectedSchedule) return;

        const ex = plannerExercises.find((e) => e.name === name);
        if (!ex) return;

        await deleteDoc(doc(db, "schedules", selectedSchedule.id, "exercises", ex.id));

        setPlannerExercises((prev) => prev.filter((e) => e.id !== ex.id));

        setScheduleExercisesCache(prev => {
            const currentCache = prev[selectedSchedule.id] || [];
            const index = currentCache.findIndex(e => e.name === name);
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

            if (exToRemove) {
                setScheduleExercisesCache(prev => {
                    const currentCache = prev[selectedSchedule.id] || [];
                    const index = currentCache.findIndex(e => e.name === exToRemove.name);
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
        field: keyof Omit<PlannerExercise, "id" | "name" | "muscle">,
        value: number
    ) => {
        if (!selectedSchedule) return;

        // Firebase strictly rejects NaN (Not a Number), catch it early
        if (isNaN(value)) return;
        if ((field === "reps" || field === "sets" || field === "timer") && value < 0) return;

        try {
            await updateDoc(doc(db, "schedules", selectedSchedule.id, "exercises", id), { [field]: value });
            setPlannerExercises((prev) =>
                prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
            );
        } catch (err) {
            console.error("Failed to update numeric property:", err);
        }
    };

    /* ================= WEEKLY MUSCLE LOGIC ================= */
    const getWeeklyMusclesHit = () => {
        const muscleTally: Record<string, number> = {};

        Object.values(weeklyPlan).forEach(scheduleId => {
            if (!scheduleId) return;

            const musclesHitToday = new Set<string>();
            const exerciseData = scheduleExercisesCache[scheduleId] || [];

            exerciseData.forEach(ex => {
                const muscles = ex.muscle ? [ex.muscle] : (exerciseMuscleMap[ex.name] || []);
                muscles.forEach(m => musclesHitToday.add(m));
            });

            musclesHitToday.forEach(m => {
                muscleTally[m] = (muscleTally[m] || 0) + 1;
            });
        });

        return Object.entries(muscleTally).sort((a, b) => a[0].localeCompare(b[0]));
    };

    /* ================= UI HELPERS ================= */
    const currentGym = gyms.find((g) => g.name === selectedGym);
    const allExercises: GymExercise[] = currentGym?.exercises ?? [];

    const allMusclesSet = new Set<string>();
    allExercises.forEach((ex) => {
        const extEx = ex as ExtendedExercise;
        const muscles = extEx.muscles ?? (extEx.muscle ? [extEx.muscle] : []);
        muscles.forEach((m: string) => {
            if (m && typeof m === "string") allMusclesSet.add(m);
        });
    });
    const allMuscles = Array.from(allMusclesSet).sort((a, b) => a.localeCompare(b));

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const displayedExercises = allExercises
        .filter((ex) => {
            const extEx = ex as ExtendedExercise;
            if (normalizedQuery) {
                if (!extEx.name.toLowerCase().includes(normalizedQuery)) return false;
            }
            if (selectedFilters.length > 0) {
                const muscles = extEx.muscles ?? (extEx.muscle ? [extEx.muscle] : []);
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

            {/* WELCOME SCREEN */}
            {screen === "welcome" && (
                <div className="welcome-screen">
                    <h1>Welcome to EagleLift! 🦅</h1>
                    <p>Let's get you started on your fitness journey.</p>
                    <div className="welcome-steps">
                        <div className="welcome-step">
                            <h3>1. Create a Schedule</h3>
                            <p>Start by creating a workout schedule on your dashboard (e.g., "Push Day", "Legs").</p>
                        </div>
                        <div className="welcome-step">
                            <h3>2. Add Workouts</h3>
                            <p>Open your schedule to add exercises. Search our database or create custom ones!</p>
                        </div>
                        <div className="welcome-step">
                            <h3>3. Plan Your Week</h3>
                            <p>Go to the Weekly Planner to assign your schedules to days of the week and track your muscle targets.</p>
                        </div>
                    </div>
                    <button onClick={() => setScreen("dashboard")} style={{ marginTop: "24px", width: "100%", fontSize: "16px", padding: "12px" }}>
                        Get Started
                    </button>
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

                    <div className="dashboard-header-buttons" style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center" }}>
                        <button onClick={createSchedule}>Create Schedule</button>
                        <button
                            className="secondary logout-btn"
                            onClick={() => {
                                auth.signOut();
                                setScreen("login");
                                setSchedules([]);
                                setSelectedSchedule(null);
                                setPlannerExercises([]);
                                setWeeklyPlan({ ...defaultPlan });
                                setScheduleExercisesCache({});
                            }}
                        >
                            Log Out
                        </button>
                        <span style={{ marginLeft: "auto", fontSize: "14px", color: "var(--color-muted)", fontWeight: "bold" }}>
                            {schedules.length} / 15 Schedules
                        </span>
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
                                        if (newName !== null) renameSchedule(schedule.id, newName);
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

                            <div style={{ marginBottom: "12px", display: "flex", gap: "8px", flexDirection: "column" }}>
                                <input
                                    placeholder="Custom exercise name..."
                                    value={customExercise}
                                    onChange={(e) => setCustomExercise((e.target as HTMLInputElement).value)}
                                    maxLength={30}
                                />
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <select
                                        value={customMuscle}
                                        onChange={(e) => setCustomMuscle((e.target as HTMLSelectElement).value)}
                                        style={{ flex: 1, margin: 0 }}
                                    >
                                        <option value="">Select Target Muscle (Optional)</option>
                                        {globalMuscles.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <button onTouchEnd={handleCustomAddTouchEnd} onClick={handleCustomAddClick}>
                                        Add
                                    </button>
                                </div>
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
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h3 style={{ margin: 0 }}>Your Workout Plan</h3>
                                <span style={{ fontSize: "14px", color: "var(--color-muted)", fontWeight: "bold" }}>
                                    {plannerExercises.length} / 15 Workouts
                                </span>
                            </div>

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
                                            <td>
                                                {ex.name}
                                                {ex.muscle && (
                                                    <div style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "4px" }}>
                                                        Target: {ex.muscle}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <input type="number" value={ex.reps} onChange={(e) => { const val = Number((e.target as HTMLInputElement).value); if (!isNaN(val) && val >= 0) updateExercise(ex.id, "reps", val); }} />
                                            </td>
                                            <td>
                                                <input type="number" value={ex.sets} onChange={(e) => { const val = Number((e.target as HTMLInputElement).value); if (!isNaN(val) && val >= 0) updateExercise(ex.id, "sets", val); }} />
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