const express = require('express');
const { body, param } = require('express-validator');
const { supabase } = require('../db/supabase');
const { validate } = require('../middleware/validate');

const router = express.Router();
const USER_FIELDS = 'id, username, email, role, avatar_url, is_banned, created_at';

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, banned, conversations, messages, recent] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('users').select(USER_FIELDS).order('created_at', { ascending: false }).limit(50),
    ]);

    const errors = [users, banned, conversations, messages, recent].map((item) => item.error).filter(Boolean);
    if (errors.length) throw errors[0];

    return res.json({
      stats: {
        users: users.count || 0,
        banned: banned.count || 0,
        conversations: conversations.count || 0,
        messages: messages.count || 0,
      },
      users: recent.data || [],
    });
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/users/:id/ban',
  [param('id').isUUID(), body('is_banned').isBoolean().toBoolean()],
  validate,
  async (req, res, next) => {
    try {
      if (req.params.id === req.user.id) {
        return res.status(400).json({ message: 'Нельзя заблокировать самого себя' });
      }
      const { data, error } = await supabase
        .from('users')
        .update({ is_banned: req.body.is_banned })
        .eq('id', req.params.id)
        .select(USER_FIELDS)
        .single();
      if (error) throw error;
      return res.json({ user: data });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
