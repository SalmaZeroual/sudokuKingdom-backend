const User = require('../models/User');
const db = require('../config/database');
const { isUserOnline } = require('../services/socketService'); // ✅ AJOUTÉ

// ==========================================
// GET FRIENDS LIST
// ==========================================
exports.getFriends = async (req, res) => {
  try {
    const userId = req.userId;

    const sql = `
      SELECT u.id, u.username, u.level, u.avatar, u.xp, u.league, u.unique_id,
             f.status, f.created_at,
             u.id as friend_id
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'accepted'
      ORDER BY u.username
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        console.error('Get friends error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      console.log(`✅ Found ${rows.length} friends for user ${userId}`);

      const friends = rows.map(row => ({
        id: row.id,
        friend_id: row.friend_id,
        username: row.username,
        level: row.level,
        avatar: row.avatar || 'king',
        xp: row.xp,
        league: row.league,
        unique_id: row.unique_id,
        is_online: isUserOnline(row.id) ? 1 : 0, // ✅ VÉRIFIE EN TEMPS RÉEL
        created_at: row.created_at,
      }));

      res.json(friends);
    });

  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// SEND FRIEND REQUEST
// ==========================================
exports.sendFriendRequest = async (req, res) => {
  try {
    const { friend_id } = req.body;
    const userId = req.userId;

    if (userId === friend_id) {
      return res.status(400).json({ error: 'Cannot add yourself as friend' });
    }

    const friend = await User.findById(friend_id);

    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.get(
      'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friend_id, friend_id, userId],
      (err, row) => {
        if (err) {
          console.error('Check friendship error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (row) {
          return res.status(400).json({ error: 'Friendship already exists' });
        }

        db.run(
          'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
          [userId, friend_id, 'pending'],
          function(err) {
            if (err) {
              console.error('Create friendship error:', err);
              return res.status(500).json({ error: 'Server error' });
            }

            res.json({ success: true, message: 'Friend request sent', id: this.lastID });
          }
        );
      }
    );

  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// ACCEPT FRIEND REQUEST
// ==========================================
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.userId;

    db.run(
      'UPDATE friendships SET status = ? WHERE id = ? AND friend_id = ?',
      ['accepted', friendshipId, userId],
      function(err) {
        if (err) {
          console.error('Accept friend request error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Friend request not found' });
        }

        db.get(
          'SELECT * FROM friendships WHERE id = ?',
          [friendshipId],
          (err, friendship) => {
            if (err || !friendship) {
              return res.json({ success: true, message: 'Friend request accepted' });
            }

            db.run(
              'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
              [friendship.friend_id, friendship.user_id, 'accepted'],
              (err) => {
                if (err) console.error('Create reverse friendship error:', err);
                res.json({ success: true, message: 'Friend request accepted' });
              }
            );
          }
        );
      }
    );

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// REJECT FRIEND REQUEST
// ==========================================
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.userId;

    db.run(
      'DELETE FROM friendships WHERE id = ? AND friend_id = ?',
      [friendshipId, userId],
      function(err) {
        if (err) {
          console.error('Reject friend request error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Friend request not found' });
        }

        res.json({ success: true, message: 'Friend request rejected' });
      }
    );

  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// GET PENDING FRIEND REQUESTS
// ==========================================
exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.userId;

    const sql = `
      SELECT f.id as friendship_id, 
             u.id, 
             u.id as user_id,
             u.username, 
             u.level, 
             u.avatar, 
             u.xp, 
             u.league,
             u.unique_id,
             f.created_at
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        console.error('Get pending requests error:', err);
        return res.status(500).json({ error: 'Server error' });
      }

      const requests = rows.map(row => ({
        ...row,
        avatar: row.avatar || 'king',
      }));

      res.json(requests);
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// ✅ MODIFIÉ : SEARCH USERS BY EXACT unique_id
// ==========================================
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.userId;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // ✅ Vérifier si c'est exactement 10 chiffres
    if (!/^\d{10}$/.test(query)) {
      return res.json([]);
    }

    const users = await User.search(query, userId);

    const friendIds = users.map(u => u.id);

    if (friendIds.length === 0) {
      return res.json([]);
    }

    const sql = `
      SELECT friend_id, status FROM friendships 
      WHERE user_id = ? AND friend_id IN (${users.map(() => '?').join(',')})
    `;

    db.all(sql, [userId, ...friendIds], (err, friendships) => {
      if (err) {
        console.error('Check friendships error:', err);
        return res.json(users.map(u => ({ 
          ...u, 
          avatar: u.avatar || 'king',
          friendship_status: null, 
          is_online: isUserOnline(u.id) // ✅ VÉRIFIE EN TEMPS RÉEL
        })));
      }

      const friendshipMap = {};
      friendships.forEach(f => {
        friendshipMap[f.friend_id] = f.status;
      });

      const result = users.map(u => ({
        ...u,
        avatar: u.avatar || 'king',
        friendship_status: friendshipMap[u.id] || null,
        is_online: isUserOnline(u.id), // ✅ VÉRIFIE EN TEMPS RÉEL
      }));

      res.json(result);
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// ✅ NOUVEAU : SEARCH FRIENDS BY NAME
// ==========================================
exports.searchFriends = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.userId;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const friends = await User.searchFriends(userId, query);

    const result = friends.map(f => ({
      ...f,
      avatar: f.avatar || 'king',
      is_online: isUserOnline(f.id) ? 1 : 0, // ✅ VÉRIFIE EN TEMPS RÉEL
    }));

    res.json(result);

  } catch (error) {
    console.error('Search friends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// REMOVE FRIEND
// ==========================================
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;

    db.run(
      'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId],
      function(err) {
        if (err) {
          console.error('Remove friend error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Friendship not found' });
        }

        res.json({ success: true, message: 'Friend removed' });
      }
    );

  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==========================================
// GET FRIEND STATS
// ==========================================
exports.getFriendStats = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;

    db.get(
      'SELECT * FROM friendships WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = ?',
      [userId, friendId, friendId, userId, 'accepted'],
      async (err, friendship) => {
        if (err) {
          console.error('Check friendship error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (!friendship) {
          return res.status(403).json({ error: 'Not friends' });
        }

        const friend = await User.findById(friendId);

        if (!friend) {
          return res.status(404).json({ error: 'User not found' });
        }

        db.all(
          `SELECT COUNT(*) as total_games, 
                  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_games,
                  AVG(time_elapsed) as avg_time,
                  MIN(time_elapsed) as best_time
           FROM games WHERE user_id = ?`,
          [friendId],
          (err, stats) => {
            if (err) {
              console.error('Get stats error:', err);
              return res.status(500).json({ error: 'Server error' });
            }

            res.json({
              user: {
                ...friend,
                avatar: friend.avatar || 'king',
              },
              stats: stats[0] || {},
            });
          }
        );
      }
    );

  } catch (error) {
    console.error('Get friend stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};