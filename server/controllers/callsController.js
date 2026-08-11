const { supabase } = require('../db/supabase');
const { membershipOf, membersOf } = require('../services/conversations');
const calls = require('../services/calls');

async function directContext(conversationId, userId) {
  const membership = await membershipOf(conversationId, userId);
  if (!membership) return null;

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, kind')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation || conversation.kind !== 'direct') return null;

  const members = await membersOf([conversationId]);
  const companion = members.find((member) => member.user_id !== userId);
  return companion ? { companionId: companion.user_id } : null;
}

function publicCall(call, viewerId) {
  return {
    id: call.id,
    conversation_id: call.conversationId,
    type: call.type,
    status: call.status,
    caller_id: call.callerId,
    peer_id: call.callerId === viewerId ? call.calleeId : call.callerId,
  };
}

async function startCall(req, res, next) {
  try {
    const context = await directContext(req.body.conversation_id, req.user.id);
    if (!context) return res.status(400).json({ message: 'Звонки доступны только в личных чатах' });

    const call = calls.createCall({
      conversationId: req.body.conversation_id,
      callerId: req.user.id,
      calleeId: context.companionId,
      type: req.body.type,
    });
    if (!call) return res.status(409).json({ message: 'В этом чате уже идёт звонок' });
    res.status(201).json({ call: publicCall(call, req.user.id) });
  } catch (err) {
    next(err);
  }
}

async function incomingCalls(req, res) {
  res.json({ calls: calls.incomingFor(req.user.id).map((call) => publicCall(call, req.user.id)) });
}

async function accessCall(req, res, next) {
  try {
    const call = calls.getCall(req.params.id);
    if (!call || ![call.callerId, call.calleeId].includes(req.user.id)) {
      return res.status(404).json({ message: 'Звонок не найден' });
    }
    req.call = call;
    next();
  } catch (err) {
    next(err);
  }
}

function getCall(req, res) {
  res.json({ call: publicCall(req.call, req.user.id) });
}

function acceptCall(req, res) {
  if (req.call.calleeId !== req.user.id || req.call.status !== 'ringing') {
    return res.status(409).json({ message: 'Этот звонок нельзя принять' });
  }
  calls.setStatus(req.call, 'accepted');
  res.json({ call: publicCall(req.call, req.user.id) });
}

function finishCall(status) {
  return (req, res) => {
    if (!['ringing', 'accepted'].includes(req.call.status)) {
      return res.json({ call: publicCall(req.call, req.user.id) });
    }
    calls.setStatus(req.call, status);
    res.json({ call: publicCall(req.call, req.user.id) });
  };
}

function addSignal(req, res) {
  const { kind, payload } = req.body;
  const isCaller = req.call.callerId === req.user.id;
  if ((kind === 'offer' && !isCaller) || (kind === 'answer' && isCaller)) {
    return res.status(403).json({ message: 'Некорректный сигнал звонка' });
  }
  if (req.call.status === 'ended' || req.call.status === 'rejected') {
    return res.status(409).json({ message: 'Звонок завершён' });
  }

  calls.addSignal(req.call, {
    senderId: req.user.id,
    recipientId: isCaller ? req.call.calleeId : req.call.callerId,
    kind,
    payload,
  });
  res.status(204).end();
}

function getSignals(req, res) {
  const after = Math.max(0, Number(req.query.after) || 0);
  const signals = req.call.signals.filter((signal) => signal.recipientId === req.user.id && signal.id > after);
  res.json({ status: req.call.status, signals });
}

module.exports = { acceptCall, accessCall, addSignal, finishCall, getCall, getSignals, incomingCalls, startCall };
