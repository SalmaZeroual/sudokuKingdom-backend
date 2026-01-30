const User = require('../models/User');
const db = require('../config/database');

// Get friends list
exports.getFriends = async (req, res) => {
  try {
    const userId = req.userId;
    
    const sql = `
      SELECT u.id, u.username, u.level, u.avatar, u.xp, u.league, f.status, f.created_at
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
      
      res.json(rows);
    });
    
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send friend request
exports.sendFriendRequest = async (req, res) => {
  try {
    const { friend_id } = req.body;
    const userId = req.userId;
    
    if (userId === friend_id) {
      return res.status(400).json({ error: 'Cannot add yourself as friend' });
    }
    
    // Check if friend exists
    const friend = await User.findById(friend_id);
    
    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if friendship already exists
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
        
        // Create friendship
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

// Accept friend request
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.userId;
    
    // Update friendship status
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
        
        // Get the friendship to create reverse relationship
        db.get(
          'SELECT * FROM friendships WHERE id = ?',
          [friendshipId],
          (err, friendship) => {
            if (err || !friendship) {
              return res.json({ success: true, message: 'Friend request accepted' });
            }
            
            // Create reverse friendship
            db.run(
              'INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)',
              [friendship.friend_id, friendship.user_id, 'accepted'],
              (err) => {
                if (err) {
                  console.error('Create reverse friendship error:', err);
                }
                
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

// Reject friend request
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

// Get pending friend requests
exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.userId;
    
    const sql = `
      SELECT f.id as friendship_id, u.id, u.username, u.level, u.avatar, u.xp, u.league, f.created_at
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
      
      res.json(rows);
    });
    
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.userId;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const users = await User.search(query, userId);
    
    // Check friendship status for each user
    const sql = `
      SELECT friend_id, status FROM friendships 
      WHERE user_id = ? AND friend_id IN (${users.map(() => '?').join(',')})
    `;
    
    const friendIds = users.map(u => u.id);
    
    if (friendIds.length === 0) {
      return res.json(users.map(u => ({ ...u, friendship_status: null })));
    }
    
    db.all(sql, [userId, ...friendIds], (err, friendships) => {
      if (err) {
        console.error('Check friendships error:', err);
        return res.json(users.map(u => ({ ...u, friendship_status: null })));
      }
      
      const friendshipMap = {};
      friendships.forEach(f => {
        friendshipMap[f.friend_id] = f.status;
      });
      
      const result = users.map(u => ({
        ...u,
        friendship_status: friendshipMap[u.id] || null,
      }));
      
      res.json(result);
    });
    
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Remove friend
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

// Get friend stats
exports.getFriendStats = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;
    
    // Check if they are friends
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
        
        // Get friend details
        const friend = await User.findById(friendId);
        
        if (!friend) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // Get friend's game stats
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
              user: friend,
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