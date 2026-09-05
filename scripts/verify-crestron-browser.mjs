import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(process.argv[2] ?? 'dist/prod/Shell');
const port = Number(process.env.PHASE0_PORT ?? 4173);
const debuggingPort = Number(process.env.PHASE0_CDP_PORT ?? 9222);
const chromeBin = process.env.CHROME_BIN;

if (!chromeBin) {
  throw new Error('CHROME_BIN must point to a Chrome/Chromium executable.');
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function waitFor(check, description, attempts = 120, interval = 250) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolvePromise) => child.once('exit', resolvePromise));
  child.kill('SIGTERM');
  await Promise.race([exited, sleep(1500)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, sleep(1000)]);
  }
}

const profilePath = '/tmp/av-interface-ai-phase0-chrome';
try {
  rmSync(profilePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
} catch {
  // A stale browser profile should not prevent a fresh isolated run.
}

const server = spawn(
  'python3',
  ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', webRoot],
  { stdio: ['ignore', 'ignore', 'inherit'] }
);

let chrome;
let socket;

try {
  const pageUrl = `http://127.0.0.1:${port}/`;
  await waitFor(async () => {
    const response = await fetch(pageUrl);
    return response.ok;
  }, 'production web server');

  chrome = spawn(
    chromeBin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--remote-allow-origins=*',
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${profilePath}`,
      pageUrl
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );

  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
    if (!response.ok) return null;
    const items = await response.json();
    return items.find((item) => item.type === 'page' && item.url.startsWith(pageUrl)) ?? null;
  }, 'Chrome DevTools page target');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', rejectPromise, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCommand, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolveCommand(message.result);
  });

  const command = (method, params = {}) => new Promise((resolveCommand, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve: resolveCommand, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const response = await command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? 'Browser evaluation failed');
    }
    return response.result?.value;
  };

  await command('Runtime.enable');

  await waitFor(
    () => evaluate(`typeof CrComLib !== 'undefined'`),
    'Crestron CrComLib runtime'
  );

  await evaluate(`(() => {
    window.__phase0DeepQuery = function deepQuery(selector, root = document) {
      if (!root) return null;
      const direct = root.querySelector?.(selector);
      if (direct) return direct;

      const elements = root.querySelectorAll?.('*') || [];
      for (const element of elements) {
        if (element.shadowRoot) {
          const nested = deepQuery(selector, element.shadowRoot);
          if (nested) return nested;
        }
        if (element.tagName === 'IFRAME') {
          try {
            const nested = deepQuery(selector, element.contentDocument);
            if (nested) return nested;
          } catch {
            // Ignore cross-origin frames; the Crestron shell content is same-origin.
          }
        }
      }
      return null;
    };
    return true;
  })()`);

  try {
    await waitFor(
      () => evaluate(`Boolean(
        window.__phase0DeepQuery('ch5-button[label="Front Display Power"]') &&
        window.__phase0DeepQuery('ch5-button[label="Table HDMI"]') &&
        window.__phase0DeepQuery('ch5-button[label="Wireless Presentation"]') &&
        window.__phase0DeepQuery('ch5-slider[aria-label="Program Audio Volume"]') &&
        window.__phase0DeepQuery('ch5-button[label="Program Audio Mute"]')
      )`),
      'generated CH5 controls'
    );
  } catch (error) {
    const diagnostic = await evaluate(`(() => ({
      title: document.title,
      readyState: document.readyState,
      crComLib: typeof CrComLib,
      lightDomButtons: [...document.querySelectorAll('ch5-button')].map(el => el.getAttribute('label')),
      lightDomSliders: [...document.querySelectorAll('ch5-slider')].map(el => el.getAttribute('aria-label')),
      pageTextIncludesMeetingRoom: document.documentElement.innerHTML.includes('Meeting Room 101'),
      pageHtmlLoaded: Boolean(window.__phase0DeepQuery('[data-screen-id="main"]'))
    }))()`);
    throw new Error(`${error.message}\nBrowser diagnostic: ${JSON.stringify(diagnostic)}`);
  }

  await evaluate(`(() => {
    window.__phase0RoundTrip = {};
    window.__phase0Subscriptions = [
      CrComLib.subscribeState('b', 'Room.FrontDisplay.Display.Power.IsActive', value => { window.__phase0RoundTrip.power = value; }),
      CrComLib.subscribeState('b', 'Room.FrontDisplay.Display.Source.TableHdmiSelected', value => { window.__phase0RoundTrip.tableHdmi = value; }),
      CrComLib.subscribeState('b', 'Room.FrontDisplay.Display.Source.WirelessSelected', value => { window.__phase0RoundTrip.wireless = value; }),
      CrComLib.subscribeState('n', 'Room.ProgramAudio.Audio.Volume.Value', value => { window.__phase0RoundTrip.volume = value; }),
      CrComLib.subscribeState('b', 'Room.ProgramAudio.Audio.Mute.IsActive', value => { window.__phase0RoundTrip.mute = value; })
    ];
    return true;
  })()`);

  const clickCh5Button = async (label) => evaluate(`(() => {
    const element = window.__phase0DeepQuery('ch5-button[label=${JSON.stringify(label)}]');
    if (!element) throw new Error('Missing CH5 button: ${label}');
    const target = element.shadowRoot?.querySelector('button') || element.querySelector('button') || element;
    target.click();
    return true;
  })()`);

  await clickCh5Button('Front Display Power');
  await waitFor(() => evaluate('window.__phase0RoundTrip.power === true'), 'power feedback true');
  await clickCh5Button('Front Display Power');
  await waitFor(() => evaluate('window.__phase0RoundTrip.power === false'), 'power feedback false');

  await clickCh5Button('Wireless Presentation');
  await waitFor(
    () => evaluate('window.__phase0RoundTrip.wireless === true && window.__phase0RoundTrip.tableHdmi === false'),
    'wireless source exclusive feedback'
  );

  await clickCh5Button('Table HDMI');
  await waitFor(
    () => evaluate('window.__phase0RoundTrip.tableHdmi === true && window.__phase0RoundTrip.wireless === false'),
    'table HDMI source exclusive feedback'
  );

  await clickCh5Button('Program Audio Mute');
  await waitFor(() => evaluate('window.__phase0RoundTrip.mute === true'), 'mute feedback true');

  await evaluate(`CrComLib.publishEvent('n', 'Room.ProgramAudio.Audio.Volume.Set', 37); true`);
  await waitFor(() => evaluate('window.__phase0RoundTrip.volume === 37'), 'volume feedback value');

  const result = await evaluate('window.__phase0RoundTrip');
  console.log(JSON.stringify({
    ok: true,
    proof: {
      powerToggledOnAndOff: true,
      sourceSelectionExclusive: true,
      muteToggledOn: true,
      volumeRoundTrip: result.volume
    },
    finalStates: result
  }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await stopProcess(chrome);
  await stopProcess(server);
  try {
    rmSync(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (cleanupError) {
    console.warn(`Browser profile cleanup warning: ${cleanupError.message}`);
  }
}
