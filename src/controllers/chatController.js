const db = require('../config/database');

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.userId;
    
    const sql = `
      SELECT 
        c.id as conversation_id,
        c.last_message_at,
        CASE 
          WHEN c.user1_id = ? THEN u2.id
          ELSE u1.id
        END as friend_id,
        CASE 
          WHEN c.user1_id = ? THEN u2.username
          ELSE u1.username
        END as friend_username,
        CASE 
          WHEN c.user1_id = ? THEN u2.avatar
          ELSE u1.avatar
        END as friend_avatar,
        CASE 
          WHEN c.user1_id = ? THEN u2.level
          ELSE u1.level
        END as friend_level,
        m.content as last_message,
        m.sender_id as last_sender_id,
        (SELECT COUNT(*) FROM messages 
         WHERE conversation_id = c.id 
         AND receiver_id = ? 
         AND is_read = 0) as unread_count
      FROM conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN messages m ON c.last_message_id = m.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC NULLS LAST
    `;
    
    db.all(sql, [userId, userId, userId, userId, userId, userId, userId], (err, rows) => {
      if (err) {
        console.error('Get conversations error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      res.json(rows || []);
    });
    
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get or create conversation with a friend
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;
    
    if (parseInt(friendId) === userId) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }
    
    // Check if friendship exists
    const friendshipSql = `
      SELECT * FROM friendships 
      WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
      AND status = 'accepted'
    `;
    
    db.get(friendshipSql, [userId, friendId, friendId, userId], (err, friendship) => {
      if (err) {
        console.error('Check friendship error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!friendship) {
        return res.status(403).json({ error: 'You must be friends to chat' });
      }
      
      // Check if conversation exists
      const convSql = `
        SELECT * FROM conversations
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
      `;
      
      db.get(convSql, [userId, friendId, friendId, userId], (err, conversation) => {
        if (err) {
          console.error('Get conversation error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (conversation) {
          return res.json({ conversation_id: conversation.id });
        }
        
        // Create new conversation
        const createSql = `
          INSERT INTO conversations (user1_id, user2_id)
          VALUES (?, ?)
        `;
        
        db.run(createSql, [userId, friendId], function(err) {
          if (err) {
            console.error('Create conversation error:', err);
            return res.status(500).json({ error: 'Server error' });
          }
          
          res.json({ conversation_id: this.lastID });
        });
      });
    });
    
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    const { limit = 50, offset = 0 } = req.query;
    
    // Check if user is part of conversation
    const convSql = `
      SELECT * FROM conversations
      WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `;
    
    db.get(convSql, [conversationId, userId, userId], (err, conversation) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!conversation) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get messages
      const messagesSql = `
        SELECT 
          m.id,
          m.sender_id,
          m.receiver_id,
          m.content,
          m.is_read,
          m.created_at,
          u.username as sender_username,
          u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      db.all(messagesSql, [conversationId, parseInt(limit), parseInt(offset)], (err, messages) => {
        if (err) {
          console.error('Get messages error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        // Reverse to show oldest first
        res.json(messages.reverse());
      });
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.userId;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }
    
    // Check if user is part of conversation
    const convSql = `
      SELECT * FROM conversations
      WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `;
    
    db.get(convSql, [conversationId, userId, userId], (err, conversation) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!conversation) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Determine receiver
      const receiverId = conversation.user1_id === userId 
        ? conversation.user2_id 
        : conversation.user1_id;
      
      // Insert message
      const insertSql = `
        INSERT INTO messages (conversation_id, sender_id, receiver_id, content)
        VALUES (?, ?, ?, ?)
      `;
      
      db.run(insertSql, [conversationId, userId, receiverId, content.trim()], function(err) {
        if (err) {
          console.error('Send message error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        const messageId = this.lastID;
        
        // Update conversation
        const updateConvSql = `
          UPDATE conversations
          SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateConvSql, [messageId, conversationId], (err) => {
          if (err) {
            console.error('Update conversation error:', err);
          }
          
          // Get the created message
          const getMessageSql = `
            SELECT 
              m.id,
              m.sender_id,
              m.receiver_id,
              m.content,
              m.is_read,
              m.created_at,
              u.username as sender_username,
              u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
          `;
          
          db.get(getMessageSql, [messageId], (err, message) => {
            if (err) {
              console.error('Get message error:', err);
              return res.status(500).json({ error: 'Server error' });
            }
            
            res.json(message);
          });
        });
      });
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    
    // Check if user is part of conversation
    const convSql = `
      SELECT * FROM conversations
      WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `;
    
    db.get(convSql, [conversationId, userId, userId], (err, conversation) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!conversation) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Mark all messages as read
      const updateSql = `
        UPDATE messages
        SET is_read = 1
        WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0
      `;
      
      db.run(updateSql, [conversationId, userId], function(err) {
        if (err) {
          console.error('Mark as read error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ success: true, marked_count: this.changes });
      });
    });
    
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    
    const sql = `
      SELECT COUNT(*) as unread_count
      FROM messages
      WHERE receiver_id = ? AND is_read = 0
    `;
    
    db.get(sql, [userId], (err, row) => {
      if (err) {
        console.error('Get unread count error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      res.json({ unread_count: row.unread_count || 0 });
    });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    
    // Check if user is part of conversation
    const convSql = `
      SELECT * FROM conversations
      WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `;
    
    db.get(convSql, [conversationId, userId, userId], (err, conversation) => {
      if (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      if (!conversation) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Delete conversation (messages will be deleted via CASCADE)
      const deleteSql = 'DELETE FROM conversations WHERE id = ?';
      
      db.run(deleteSql, [conversationId], function(err) {
        if (err) {
          console.error('Delete conversation error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ success: true, message: 'Conversation deleted' });
      });
    });
    
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};