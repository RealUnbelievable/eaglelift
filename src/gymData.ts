export type GymExercise = {
  name: string;
  // legacy single-field kept for compatibility
  muscle?: string;
  // canonical field: zero-or-more target muscles (preferred)
  muscles: string[];
  // optional metadata for future filters/UI
  equipment?: string[];
  notes?: string;
};

export type Gym = {
  name: string;
  exercises: GymExercise[];
};

export const gyms: Gym[] = [
  {
    name: "Straz Tower",
    exercises: [
      { name: "Chest Press Machine", muscle: "Chest", muscles: ["Chest"], equipment: ["Machine"] },
      { name: "Incline Chest Press", muscles: ["Chest", "Shoulders"], equipment: ["Machine"] },
      { name: "Decline Chest Press", muscles: ["Chest", "Triceps"], equipment: ["Machine"] },

      { name: "Pec Deck / Rear Delt Fly", muscle: "Chest", muscles: ["Chest", "Rear Delts"], equipment: ["Machine"] },

      { name: "Bench Press (Barbell)", muscles: ["Chest", "Shoulders", "Triceps"], equipment: ["Barbell"] },
      { name: "Incline Bench Press (Barbell)", muscles: ["Upper Chest", "Shoulders", "Triceps"], equipment: ["Barbell"] },
      { name: "Decline Bench Press (Barbell)", muscles: ["Lower Chest", "Shoulders", "Triceps"], equipment: ["Barbell"] },

      { name: "Lat Pulldown Station", muscle: "Back", muscles: ["Lats", "Biceps"], equipment: ["Machine"] },
      { name: "Seated Row Machine", muscle: "Back", muscles: ["Middle Back", "Biceps"], equipment: ["Machine"] },

      { name: "Leg Press (Seated)", muscle: "Legs", muscles: ["Quads", "Glutes"], equipment: ["Machine"] },
      { name: "Leg Extension", muscle: "Legs", muscles: ["Quads"], equipment: ["Machine"] },
      { name: "Leg Curl (Prone/Seated)", muscle: "Legs", muscles: ["Hamstrings"], equipment: ["Machine"] },

      { name: "Smith Machine", muscle: "Full Body", muscles: ["Full Body"], equipment: ["Smith Machine"], notes: "Used for squats, presses, rows depending on setup" },

      { name: "Concept2 Rowing Ergometer", muscle: "Cardio", muscles: ["Cardio"], equipment: ["Ergometer"] },

      // Added common variations
      { name: "Calf Raises", muscles: ["Calves"], equipment: ["Machine", "Bodyweight"] },
      { name: "Standing Calf Raise (Machine)", muscles: ["Calves"], equipment: ["Machine"] },

      { name: "Shoulder Press (Machine)", muscle: "Shoulders", muscles: ["Shoulders", "Triceps"], equipment: ["Machine"] },
      { name: "Dumbbell Shoulder Press", muscles: ["Shoulders", "Triceps"], equipment: ["Dumbbell"] },

      { name: "Bicep Curls (Dumbbell)", muscles: ["Biceps"], equipment: ["Dumbbell"] },
      { name: "Bicep Curl Machine", muscle: "Arms", muscles: ["Biceps"], equipment: ["Machine"] },
      { name: "StairMaster", muscle: "Cardio", muscles: ["Cardio"], equipment: ["Cardio Machine"] },
      { name: "Tricep Extension (Cable)", muscles: ["Triceps"], equipment: ["Cable"] }

    ]
  },
  {
    name: "Wellness + Helfaer Rec Plex",
    exercises: [
      { name: "Chest Press (Selectorized)", muscle: "Chest", muscles: ["Chest"], equipment: ["Machine"] },
      { name: "Incline Chest Press", muscles: ["Chest", "Shoulders"], equipment: ["Machine"] },

      { name: "Shoulder Press", muscle: "Shoulders", muscles: ["Shoulders", "Triceps"], equipment: ["Machine"] },

      { name: "Lat Pulldown", muscle: "Back", muscles: ["Lats", "Biceps"], equipment: ["Machine"] },
      { name: "Seated Row Machine", muscle: "Back", muscles: ["Middle Back", "Biceps"], equipment: ["Machine"] },

      { name: "Bicep Curl Machine", muscle: "Arms", muscles: ["Biceps"], equipment: ["Machine"] },
      { name: "Dumbbell Bicep Curl", muscles: ["Biceps"], equipment: ["Dumbbell"] },

      { name: "Tricep Extension Machine", muscle: "Arms", muscles: ["Triceps"], equipment: ["Machine"] },

      { name: "Leg Press (Plate Loaded)", muscle: "Legs", muscles: ["Quads", "Glutes"], equipment: ["Machine"] },
      { name: "Hip Adductor", muscle: "Legs", muscles: ["Glutes", "Hip Adductors"], equipment: ["Machine"] },
      { name: "Hip Abductor", muscle: "Legs", muscles: ["Glutes", "Hip Abductors"], equipment: ["Machine"] },

      { name: "StairMaster", muscle: "Cardio", muscles: ["Cardio"], equipment: ["Cardio Machine"] },

      // Added common variations and extras
      { name: "Romanian Deadlift (Barbell)", muscles: ["Hamstrings", "Glutes", "Lower Back"], equipment: ["Barbell"] },
      { name: "Conventional Deadlift", muscles: ["Back", "Glutes"], equipment: ["Barbell"] },

      { name: "Squat (Barbell)", muscles: ["Quads", "Glutes", "Hamstrings"], equipment: ["Barbell"] },
      { name: "Front Squat", muscles: ["Quads", "Core"], equipment: ["Barbell"] },

      { name: "Cable Fly", muscles: ["Chest"], equipment: ["Cable Machine"] },

      { name: "Pull-Up / Chin-Up", muscles: ["Lats", "Biceps"], equipment: ["Bodyweight", "Bar"] },

      { name: "Leg Curl (Seated)", muscle: "Legs", muscles: ["Hamstrings"], equipment: ["Machine"] },
      { name: "Leg Extension (Seated)", muscle: "Legs", muscles: ["Quads"], equipment: ["Machine"] }
    ]
  }
];