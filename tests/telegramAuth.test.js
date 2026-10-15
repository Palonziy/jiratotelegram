const assert = require('assert');
const test = require('node:test');
const TelegramBotService = require('../src/telegram/telegramBot');
const config = require('../src/config');

test('TelegramBotService - Authorization & Access Control', async () => {
  const bot = new TelegramBotService('test-token');

  // Override allowedUsers for testing
  config.telegram.allowedUsers = ['palonziy', '6552342794'];

  // 1. Authorized by username: @palonziy
  const authorizedMsg1 = {
    message_id: 1,
    from: { id: 11111, username: 'palonziy' },
    chat: { id: 11111 },
    text: '/today'
  };
  assert.strictEqual(bot.isAuthorized(authorizedMsg1), true, 'User @palonziy must be authorized');

  // 2. Authorized by uppercase username: @Palonziy
  const authorizedMsg2 = {
    message_id: 2,
    from: { id: 11111, username: 'Palonziy' },
    chat: { id: 11111 },
    text: '/today'
  };
  assert.strictEqual(bot.isAuthorized(authorizedMsg2), true, 'User @Palonziy (case-insensitive) must be authorized');

  // 3. Authorized by allowed user ID
  const authorizedMsg3 = {
    message_id: 3,
    from: { id: 6552342794, first_name: 'Ogabek' },
    chat: { id: 6552342794 },
    text: '/start'
  };
  assert.strictEqual(bot.isAuthorized(authorizedMsg3), true, 'User with ID 6552342794 must be authorized');

  // 4. Unauthorized user: @intruder
  const unauthorizedMsg1 = {
    message_id: 4,
    from: { id: 999999, username: 'intruder' },
    chat: { id: 999999 },
    text: '/start'
  };
  assert.strictEqual(bot.isAuthorized(unauthorizedMsg1), false, 'User @intruder must be blocked');

  // 5. Unauthorized user: unknown ID with no username
  const unauthorizedMsg2 = {
    message_id: 5,
    from: { id: 888888, first_name: 'Unknown Person' },
    chat: { id: 888888 },
    text: '/today'
  };
  assert.strictEqual(bot.isAuthorized(unauthorizedMsg2), false, 'Unknown user without username must be blocked');

  // 6. Null or malformed message
  assert.strictEqual(bot.isAuthorized(null), false, 'Null message must be rejected');
  assert.strictEqual(bot.isAuthorized({}), false, 'Empty message must be rejected');
});

test('TelegramBotService - handleUpdate Rejection for Unauthorized Users', async () => {
  const bot = new TelegramBotService('test-token');
  config.telegram.allowedUsers = ['palonziy'];

  let sentMessage = null;
  bot.sendMessage = async (chatId, text) => {
    sentMessage = { chatId, text };
    return { ok: true };
  };

  // Test unauthorized /start
  await bot.handleUpdate({
    update_id: 101,
    message: {
      message_id: 1,
      from: { id: 99999, username: 'random_user' },
      chat: { id: 99999 },
      text: '/start'
    }
  });

  assert.ok(sentMessage, 'A rejection message must be sent to unauthorized user');
  assert.strictEqual(sentMessage.chatId, 99999);
  assert.ok(sentMessage.text.includes('siz Rentmi jamoasidan emassiz'), 'Rejection must state user is not part of Rentmi team');
  assert.ok(sentMessage.text.includes('@palonziy'), 'Rejection must direct to @palonziy');

  // Test unauthorized /today (data privacy check)
  sentMessage = null;
  await bot.handleUpdate({
    update_id: 102,
    message: {
      message_id: 2,
      from: { id: 99999, username: 'random_user' },
      chat: { id: 99999 },
      text: '/today'
    }
  });

  assert.ok(sentMessage, 'Rejection message must be sent on /today attempt');
  assert.ok(sentMessage.text.includes('Kirish taqiqlangan'), 'Must reject /today command');
  assert.ok(!sentMessage.text.includes('JIRA QA ANALYTICS'), 'Must NOT leak QA analytics report');

  // Test authorized @palonziy /start
  sentMessage = null;
  await bot.handleUpdate({
    update_id: 103,
    message: {
      message_id: 3,
      from: { id: 12345, username: 'palonziy' },
      chat: { id: 12345 },
      text: '/start'
    }
  });

  assert.ok(sentMessage, 'Authorized user must receive welcome message');
  assert.ok(sentMessage.text.includes('Welcome to Rentmi Jira QA Analytics Bot'), 'Welcome message must be returned to @palonziy');
});
