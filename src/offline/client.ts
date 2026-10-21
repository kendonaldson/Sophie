import type { OfflineReply, OfflineRequest } from './protocol';

/** Failed first installs must release the setup UI so the player can retry. */
export function waitForActive(registration: ServiceWorkerRegistration) {
  if (registration.active) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const worker = registration.installing ?? registration.waiting;
    if (!worker) {
      reject(new Error('The offline worker could not start.'));
      return;
    }
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant')
        finish(new Error('The offline worker could not start.'));
    };
    const timeout = setTimeout(
      () => finish(new Error('Offline setup timed out. Please try again.')),
      60000,
    );
    worker.addEventListener('statechange', check);
    check();
  });
}

/** Keep downloads alive across progress messages, and release ports on failure. */
export function requestOffline(
  worker: ServiceWorker,
  request: OfflineRequest,
  onProgress?: (reply: OfflineReply) => void,
): Promise<OfflineReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timeout: ReturnType<typeof setTimeout>;
    const close = () => {
      clearTimeout(timeout);
      channel.port1.close();
    };
    const armTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        close();
        reject(new Error('The download stopped responding. Please try again.'));
      }, 60000);
    };
    channel.port1.onmessage = (event: MessageEvent<OfflineReply>) => {
      const reply = event.data;
      if (!reply || typeof reply.version !== 'string') return;
      armTimeout();
      if (reply.type === 'PROGRESS') onProgress?.(reply);
      else {
        close();
        if (reply.type === 'ERROR')
          reject(new Error(reply.error || 'The offline download failed.'));
        else resolve(reply);
      }
    };
    channel.port1.onmessageerror = () => {
      close();
      reject(new Error('Could not read the offline download status.'));
    };
    armTimeout();
    try {
      worker.postMessage(request, [channel.port2]);
    } catch (error) {
      close();
      reject(error);
    }
  });
}
