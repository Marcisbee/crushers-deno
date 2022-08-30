import { HandlerContext } from '$fresh/server.ts';
import { loadState } from 'exome';

import { Room, Me, buildPayload } from '../../store/game.ts';

const room = new Room();

export const handler = (req: Request, ctx: HandlerContext): Response => {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response(null, { status: 501 });
  }

  const { socket: ws, response } = Deno.upgradeWebSocket(req);
  let broadcast: ((message: string) => void) | undefined;

  const me = new Me();

  ws.onclose = (e) => {
    if (!e.target) {
      return;
    }

    const player = room.leave(e.target as any);
    console.log(player.name, 'left room');
    broadcast?.(`"${player.name} left the game"`);
  }

  ws.onmessage = (e) => {
    console.log('message', e);
    const { type, data } = JSON.parse(e.data);

    if (type === 'actions') {
      console.log(loadState(me.controller!, data));
    }

    room.sync();
  }

  ws.onopen = (e) => {
    if (!e.target) {
      return;
    }

    broadcast = room.join(e.target as any);
    const player = (e.target as any).controller;

    if (!player) {
      console.log('cant join, server full');
      return;
    }

    me.update(room, player);
    ws.send(buildPayload('me', me));
    // broadcast('');

    console.log(player.name, 'joined room');
  }

  return response;
};
