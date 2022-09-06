import { HandlerContext } from '$fresh/server.ts';
import { getExomeId, loadState } from 'exome';

import { Controllers } from '../../store/controllers.ts';
import { Room, buildPayload } from '../../store/game.ts';

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
    const { type, data } = JSON.parse(e.data);

    if (type === 'join') {
      loadState(localControllers, data);
      room.join(ws, localControllers);
      return;
    }

    // @TODO:
    // 1. Find out why all players disconnect when one leaves

    if (type === 'actions') {
      const exomeId = JSON.parse(data).$$exome_id;
      const index = room.controllers.findIndex((c) => c.player && getExomeId(c.player) === exomeId);
      loadState(room.controllers[index].player!, data);
      room.broadcast(e.target as any, buildPayload('position', room.controllers[index].player, index));
      return;
    }

  }

  ws.onopen = (e) => {
    if (!e.target) {
      return;
    }

    // room.join(e.target as any);
    // const player = (e.target as any).controller;

    // console.log(player);

    // if (!player) {
    //   console.log('cant join, server full');
    //   return;
    // }

    // me.update(room, player);
    // ws.send(buildPayload('me', me));
    // // broadcast('');

    // console.log(player.name, 'joined room');
  }

  return response;
};
