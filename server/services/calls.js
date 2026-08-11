const { randomUUID } = require('crypto');

const CALL_TTL_MS = 2 * 60 * 60 * 1000;
const calls = new Map();

function prune() {
  const deadline = Date.now() - CALL_TTL_MS;
  for (const [id, call] of calls) {
    if (call.updatedAt < deadline) calls.delete(id);
  }
}

function createCall({ conversationId, callerId, calleeId, type }) {
  prune();
  for (const call of calls.values()) {
    if (call.conversationId === conversationId && ['ringing', 'accepted'].includes(call.status)) {
      return null;
    }
  }

  const call = {
    id: randomUUID(),
    conversationId,
    callerId,
    calleeId,
    type,
    status: 'ringing',
    signals: [],
    nextSignalId: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  calls.set(call.id, call);
  return call;
}

function getCall(id) {
  prune();
  return calls.get(id) || null;
}

function setStatus(call, status) {
  call.status = status;
  call.updatedAt = Date.now();
}

function addSignal(call, { senderId, recipientId, kind, payload }) {
  call.signals.push({ id: call.nextSignalId++, senderId, recipientId, kind, payload });
  // Кандидаты ICE короткоживущие: ограничиваем память даже при плохом соединении.
  if (call.signals.length > 300) call.signals.splice(0, call.signals.length - 300);
  call.updatedAt = Date.now();
}

function incomingFor(userId) {
  prune();
  return [...calls.values()].filter((call) => call.calleeId === userId && call.status === 'ringing');
}

module.exports = { addSignal, createCall, getCall, incomingFor, setStatus };
