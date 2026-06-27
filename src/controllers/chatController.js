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

// ✅ NOUVEAU : migration douce (comme updateDiscoverability dans userController) :
// ajoute la colonne accepts_messages et la table message_blocks si elles
// n'existent pas encore. Idempotent, ignore l'erreur si déjà présent.
function ensureMessagingSchema() {
  return new Promise((resolve) => {
    db.run(
      'ALTER TABLE users ADD COLUMN accepts_messages INTEGER DEFAULT 1',
      () => {
        db.run(
          `CREATE TABLE IF NOT EXISTS message_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blocker_id INTEGER NOT NULL,
            blocked_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(blocker_id, blocked_id),
            FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
          )`,
          () => resolve()
        );
      }
    );
  });
}

// Get or create conversation with a friend
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;
    
    if (parseInt(friendId) === userId) {
      return res.status(400).json({ error: 'Cannot chat with yourself' });
    }
    
    // ✅ Bug corrigé : avant, on exigeait TOUJOURS l'amitié, même pour
    // continuer une conversation déjà existante. Du coup, après avoir
    // retiré quelqu'un en ami, l'ouverture du chat échouait avec
    // "vous devez être amis" — alors que rien n'empêche de continuer à
    // parler à quelqu'un avec qui on a déjà discuté.
    // On vérifie maintenant D'ABORD si une conversation existe déjà :
    // si oui, on la retourne sans condition. L'amitié n'est requise que
    // pour DÉMARRER une toute nouvelle conversation.
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

      // Pas de conversation existante : il faut être amis pour en créer une.
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
          return res.status(403).json({ error: 'You must be friends to start a new conversation' });
        }

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
    
    db.get(convSql, [conversationId, userId, userId], async (err, conversation) => {
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

      // ✅ NOUVEAU : le blocage est indépendant de l'amitié. On reste amis
      // (on peut toujours se défier en duel), mais plus aucun message ne
      // passe entre les deux, dans aucun sens, jusqu'au déblocage.
      await ensureMessagingSchema();

      db.get(
        `SELECT * FROM message_blocks 
         WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
        [userId, receiverId, receiverId, userId],
        (err, block) => {
          if (err) {
            console.error('Check block error:', err);
            return res.status(500).json({ error: 'Server error' });
          }

          if (block) {
            return res.status(403).json({
              error: 'Vous ne pouvez pas envoyer de message à cet utilisateur.',
              blocked: true,
            });
          }

          // ✅ NOUVEAU : préférence globale "accepter les messages".
          db.get('SELECT accepts_messages FROM users WHERE id = ?', [receiverId], (err, receiver) => {
            if (err) {
              console.error('Check accepts_messages error:', err);
              return res.status(500).json({ error: 'Server error' });
            }

            if (receiver && receiver.accepts_messages === 0) {
              return res.status(403).json({
                error: 'Cet utilisateur n\'accepte pas les messages pour le moment.',
                messages_disabled: true,
              });
            }

            _insertMessage(conversationId, userId, receiverId, content, res);
          });
        }
      );
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper d'insertion effective du message (factorisé hors de sendMessage
// pour rester lisible malgré les vérifications de blocage ajoutées).
function _insertMessage(conversationId, userId, receiverId, content, res) {
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

    const updateConvSql = `
      UPDATE conversations
      SET last_message_id = ?, last_message_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(updateConvSql, [messageId, conversationId], (err) => {
      if (err) {
        console.error('Update conversation error:', err);
      }

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
}

// ══════════════════════════════════════════════
// BLOCAGE DES MESSAGES (indépendant de l'amitié)
// ══════════════════════════════════════════════

// Bloquer les messages d'un utilisateur (reste ami, mais plus de messages)
exports.blockUser = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;
    await ensureMessagingSchema();

    db.run(
      'INSERT OR IGNORE INTO message_blocks (blocker_id, blocked_id) VALUES (?, ?)',
      [userId, friendId],
      (err) => {
        if (err) {
          console.error('Block user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ success: true, blocked: true });
      }
    );
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Débloquer
exports.unblockUser = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.userId;
    await ensureMessagingSchema();

    db.run(
      'DELETE FROM message_blocks WHERE blocker_id = ? AND blocked_id = ?',
      [userId, friendId],
      (err) => {
        if (err) {
          console.error('Unblock user error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ success: true, blocked: false });
      }
    );
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Statut d'une conversation : peut-on envoyer un message ? Permet au
// client d'afficher directement "Vous ne pouvez pas envoyer de message"
// au lieu d'attendre un échec d'envoi pour le découvrir.
exports.getConversationStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;
    await ensureMessagingSchema();

    db.get(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, userId, userId],
      (err, conversation) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!conversation) return res.status(403).json({ error: 'Access denied' });

        const otherId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

        db.get(
          `SELECT * FROM message_blocks 
           WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
          [userId, otherId, otherId, userId],
          (err, block) => {
            if (err) return res.status(500).json({ error: 'Server error' });

            if (block) {
              return res.json({
                can_send: false,
                reason: 'blocked',
                i_blocked_them: block.blocker_id === userId,
              });
            }

            db.get('SELECT accepts_messages FROM users WHERE id = ?', [otherId], (err, other) => {
              if (err) return res.status(500).json({ error: 'Server error' });

              if (other && other.accepts_messages === 0) {
                return res.json({ can_send: false, reason: 'messages_disabled', i_blocked_them: false });
              }

              res.json({ can_send: true, reason: null, i_blocked_them: false });
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Get conversation status error:', error);
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