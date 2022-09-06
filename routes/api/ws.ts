import { HandlerContext } from '$fresh/server.ts';
import { loadState } from 'exome';

import { Controllers } from '../../store/controllers.ts';
import { Room } from '../../store/game.ts';
import { schema } from '../../utils/schema.ts';

const room = new Room();

export const handler = (req: Request, ctx: HandlerContext): Response => {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response(null, { status: 501 });
  }

  const localControllers = new Controllers();
  const { socket: ws, response } = Deno.upgradeWebSocket(req);

  ws.onclose = (e) => {
    if (!e.target) {
      return;
    }

    room.leave(e.target as any, localControllers);
  }

  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      const arrayBuffer = new Uint8Array(e.data);
      const payload = schema.decodeExample(arrayBuffer);

      if (payload.actions) {
        room.broadcast(e.target as any, e.data);
        Object.assign(
          room.controllers[payload.index].player!,
          payload.actions,
        );
        // loadState(room.controllers[payload.index].player!, payload.actions);
        return;
      }

      return;
    }

    const { type, data } = JSON.parse(e.data);

    if (type === 'join') {
      loadState(localControllers, data);
      room.join(ws, localControllers);
      return;
    }
  }

  ws.onopen = (e) => {
    if (!e.target) {
      return;
    }
  }

  return response;
};
