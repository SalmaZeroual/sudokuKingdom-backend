// Calculate XP based on difficulty, time, and mistakes
exports.calculateXP = (difficulty, timeElapsed, mistakes) => {
  const baseXP = {
    'facile': 50,
    'moyen': 100,
    'difficile': 200,
    'extreme': 500,
  };
  
  let xp = baseXP[difficulty] || 100;
  
  // Time bonus (faster completion = more XP)
  const timeMinutes = timeElapsed / 60;
  
  if (timeMinutes < 5) {
    xp *= 1.5;
  } else if (timeMinutes < 10) {
    xp *= 1.2;
  } else if (timeMinutes > 30) {
    xp *= 0.8;
  }
  
  // Mistakes penalty
  const mistakesPenalty = Math.min(mistakes * 5, 50); // Max 50% penalty
  xp -= (xp * mistakesPenalty / 100);
  
  return Math.floor(xp);
};

// Calculate level from XP
exports.calculateLevel = (xp) => {
  return Math.floor(xp / 100) + 1;
};

// Calculate XP needed for next level
exports.xpForNextLevel = (level) => {
  return level * 100;
};