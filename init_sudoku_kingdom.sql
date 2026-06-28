-- Exécute ce fichier UNE SEULE FOIS sur ta base de données
-- Il crée ou met à jour l'expéditeur système "Sudoku Kingdom"

INSERT INTO users (
  id, username, email, password_hash,
  xp, level, avatar, wins, streak, league,
  email_verified, created_at
) VALUES (
  999,
  'Sudoku Kingdom',
  'system@sudokukingdom.com',
  'SYSTEM_ACCOUNT_NO_LOGIN',
  0, 1, '👑', 0, 0, 'Bronze',
  1, CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
  username = 'Sudoku Kingdom',
  avatar   = '👑';