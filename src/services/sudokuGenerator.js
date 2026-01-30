// Generate a complete Sudoku solution
function generateSolution() {
  const grid = Array(9).fill(0).map(() => Array(9).fill(0));
  
  function isValid(grid, row, col, num) {
    // Check row
    for (let i = 0; i < 9; i++) {
      if (grid[row][i] === num) return false;
    }
    
    // Check column
    for (let i = 0; i < 9; i++) {
      if (grid[i][col] === num) return false;
    }
    
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[boxRow + i][boxCol + j] === num) return false;
      }
    }
    
    return true;
  }
  
  function solve(grid) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          
          // Shuffle numbers for randomness
          for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
          }
          
          for (const num of numbers) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              
              if (solve(grid)) {
                return true;
              }
              
              grid[row][col] = 0;
            }
          }
          
          return false;
        }
      }
    }
    
    return true;
  }
  
  solve(grid);
  return grid;
}

// Remove cells to create puzzle
function createPuzzle(solution, difficulty) {
  const difficultyLevels = {
    'facile': 30,
    'moyen': 40,
    'difficile': 50,
    'extreme': 60,
  };
  
  const cellsToRemove = difficultyLevels[difficulty] || 40;
  
  // Deep copy solution
  const puzzle = solution.map(row => [...row]);
  
  let removed = 0;
  const positions = [];
  
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      positions.push([i, j]);
    }
  }
  
  // Shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  // Remove cells
  for (const [row, col] of positions) {
    if (removed >= cellsToRemove) break;
    
    puzzle[row][col] = 0;
    removed++;
  }
  
  return puzzle;
}

// Main function to generate Sudoku
exports.generateSudoku = (difficulty = 'moyen') => {
  const solution = generateSolution();
  const grid = createPuzzle(solution, difficulty);
  
  return {
    grid,
    solution,
  };
};

// Validate Sudoku solution
exports.validateSudoku = (grid) => {
  function isValid(grid, row, col, num) {
    // Check row
    for (let i = 0; i < 9; i++) {
      if (i !== col && grid[row][i] === num) return false;
    }
    
    // Check column
    for (let i = 0; i < 9; i++) {
      if (i !== row && grid[i][col] === num) return false;
    }
    
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const currentRow = boxRow + i;
        const currentCol = boxCol + j;
        
        if (currentRow !== row && currentCol !== col && 
            grid[currentRow][currentCol] === num) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const num = grid[row][col];
      if (num === 0) return false;
      if (!isValid(grid, row, col, num)) return false;
    }
  }
  
  return true;
};