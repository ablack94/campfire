type Channel = { id: string; name: string };
type Message = { id: string; channelId: string; author: string; content: string; timestamp: number };

type IncomingEvent =
  | { type: 'presence'; users: string[] }
  | { type: 'message'; payload: Message };

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

app.innerHTML = `
<style>
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #1e1f22; color: #dbdee1; }
  .layout { display: grid; grid-template-columns: 220px 1fr 220px; height: 100vh; }
  .panel { padding: 12px; border-right: 1px solid #2b2d31; }
  .panel:last-child { border-right: 0; border-left: 1px solid #2b2d31; }
  h3 { margin: 0 0 12px; }
  .channel { display: block; width: 100%; margin: 4px 0; padding: 8px; border: none; border-radius: 6px; text-align: left; background: transparent; color: #b5bac1; cursor: pointer; }
  .channel:hover, .channel.active { background: #35373c; color: white; }
  .chat { display: grid; grid-template-rows: 1fr auto; }
  #messages { overflow-y: auto; padding: 12px; }
  .message { margin-bottom: 10px; }
  .meta { color: #949ba4; font-size: 12px; }
  form { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #2b2d31; }
  input, button { border: 1px solid #3f4147; border-radius: 8px; padding: 10px; background: #2b2d31; color: white; }
  .user { margin: 6px 0; }
</style>
<div class="layout">
  <aside class="panel">
    <h3>Campfire</h3>
    <div id="channels"></div>
  </aside>
  <section class="chat">
    <div id="messages"></div>
    <form id="compose">
      <input id="messageInput" placeholder="Message #general" />
      <button type="submit">Send</button>
    </form>
  </section>
  <aside class="panel">
    <h3>Online</h3>
    <div id="presence"></div>
  </aside>
</div>
`;

const channelsEl = document.querySelector<HTMLDivElement>('#channels')!;
const messagesEl = document.querySelector<HTMLDivElement>('#messages')!;
const composeEl = document.querySelector<HTMLFormElement>('#compose')!;
const inputEl = document.querySelector<HTMLInputElement>('#messageInput')!;
const presenceEl = document.querySelector<HTMLDivElement>('#presence')!;

const username = `user-${Math.floor(Math.random() * 1000)}`;
let activeChannel = 'general';
let cache: Message[] = [];
let channels: Channel[] = [];

function renderChannels() {
  channelsEl.innerHTML = channels
    .map((channel) => `<button class="channel ${channel.id === activeChannel ? 'active' : ''}" data-id="${channel.id}">${channel.name}</button>`)
    .join('');

  channelsEl.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.addEventListener('click', async () => {
      activeChannel = button.dataset.id ?? 'general';
      await loadMessages(activeChannel);
      renderChannels();
    });
  });
}

function renderMessages() {
  const list = cache.filter((message) => message.channelId === activeChannel);
  messagesEl.innerHTML = list
    .map((message) => `<div class="message"><strong>${message.author}</strong><div>${message.content}</div><div class="meta">${new Date(message.timestamp).toLocaleTimeString()}</div></div>`)
    .join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadChannels() {
  const res = await fetch('/api/channels');
  channels = (await res.json()) as Channel[];
  renderChannels();
}

async function loadMessages(channelId: string) {
  const res = await fetch(`/api/messages/${channelId}`);
  const history = (await res.json()) as Message[];
  cache = cache.filter((m) => m.channelId !== channelId).concat(history);
  renderMessages();
}

composeEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = inputEl.value.trim();
  if (!content) return;

  await fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId: activeChannel, content, author: username })
  });
  inputEl.value = '';
});

await fetch('/api/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username })
});

const events = new EventSource('/api/events');
events.addEventListener('message', (event) => {
  const parsed = JSON.parse(event.data) as IncomingEvent;

  if (parsed.type === 'presence') {
    presenceEl.innerHTML = parsed.users.map((user) => `<div class="user">${user}</div>`).join('');
    return;
  }

  cache.push(parsed.payload);
  if (parsed.payload.channelId === activeChannel) {
    renderMessages();
  }
});

await loadChannels();
await loadMessages(activeChannel);

export {};
