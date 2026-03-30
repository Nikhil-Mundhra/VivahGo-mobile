async function dispatchReminders(env) {
  const endpoint = String(env.PLANNER_DISPATCH_URL || '').trim();
  const secret = String(env.REMINDER_DISPATCH_SECRET || '').trim();
  const limit = Number(env.REMINDER_DISPATCH_LIMIT || 25);

  if (!endpoint || !secret) {
    return new Response('Missing worker configuration.', { status: 500 });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-reminder-secret': secret,
    },
    body: JSON.stringify({ limit }),
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export default {
  async fetch(_request, env) {
    return dispatchReminders(env);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatchReminders(env));
  },
};
