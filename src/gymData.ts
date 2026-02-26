export type GymExercise = {
  name: string;
  muscle: string;
};

export type Gym = {
  name: string;
  exercises: GymExercise[];
};

export const gyms: Gym[] = [
  {
    name: "Straz Tower",
    exercises: [
      { name: "Chest Press Machine", muscle: "Chest" },
      { name: "Pec Deck / Rear Delt Fly", muscle: "Chest" },
      { name: "Lat Pulldown Station", muscle: "Back" },
      { name: "Seated Row Machine", muscle: "Back" },
      { name: "Leg Press (Seated)", muscle: "Legs" },
      { name: "Leg Extension", muscle: "Legs" },
      { name: "Leg Curl (Prone/Seated)", muscle: "Legs" },
      { name: "Smith Machine", muscle: "Full Body" },
      { name: "Concept2 Rowing Ergometer", muscle: "Cardio" }
    ]
  },
  {
    name: "Wellness + Helfaer Rec Plex",
    exercises: [
      { name: "Chest Press (Selectorized)", muscle: "Chest" },
      { name: "Incline Chest Press", muscle: "Chest" },
      { name: "Shoulder Press", muscle: "Shoulders" },
      { name: "Lat Pulldown", muscle: "Back" },
      { name: "Seated Row", muscle: "Back" },
      { name: "Bicep Curl Machine", muscle: "Arms" },
      { name: "Tricep Extension Machine", muscle: "Arms" },
      { name: "Leg Press (Plate Loaded)", muscle: "Legs" },
      { name: "Hip Abductor / Adductor", muscle: "Legs" },
      { name: "StairMaster", muscle: "Cardio" }
    ]
  }
];