import { Exome, saveState, registerLoadable } from 'exome';

import { getRandomColor } from '../utils/color.ts';

class Player extends Exome {
  public color = getRandomColor();
}

export function buildPayload(type: 'sync' | 'me' | 'actions', data: any) {
  if (data instanceof Exome) {
    return JSON.stringify({ type, data: saveState(data)});
  }

  return JSON.stringify({ type, data })
}

type Action = 'up' | 'down' | 'left' | 'right';

export class Controller extends Exome {
  public keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  public player = new Player();

  public x = 0;
  public y = 0;
  public dy = 0;
  public dx = 0;
  public actions: Action[] = [];
  public isGrounded = false;
  public isDead = false;
  public score = 0;

  constructor(
    public name: string = `${Math.random()} Rabbit`
  ) {
    super();
  }

  public addAction(action: Action) {
    if (this.actions.indexOf(action) > -1) {
      console.log('Action already exists');
      return;
    }

    this.actions.push(action);
  }

  public removeAction(action: Action) {
    this.actions.splice(this.actions.indexOf(action), 1);
  }

  public up() {}
  public upStop() {}
  public left() {}
  public leftStop() {}
  public down() {}
  public downStop() {}
  public right() {}
  public rightStop() {}
}

interface WebSocketGame extends WebSocket {
  controller?: Controller;
}

export class Room extends Exome {
  public connections: WebSocket[] = [];
  public max = 2;

  public join(ws: WebSocketGame) {
    if (this.connections.length > this.max) {
      console.log('MAX REACHED');
      return;
    }

    ws.controller = new Controller();
    this.connections.push(ws);

    this.sync();

    return (message: string) => {
      this.connections.forEach((wsChild) => {
        if (wsChild === ws) {
          return;
        }

        wsChild.send(message);
      });
    };
  }

  public leave(ws: WebSocketGame) {
    const index = this.connections.indexOf(ws);
    this.connections.splice(index, 1);

    this.sync();

    return ws.controller!;
  }

  public sync = () => {
    this.connections.forEach((ws) => {
      ws.send(buildPayload('sync', this));
    });
  }
}

export class Me extends Exome {
  public room?: Room;
  public controller?: Controller;

  public update(room?: Room, controller?: Controller) {
    this.room = room;
    this.controller = controller;
  }
}

export const room = new Room();

registerLoadable({
  Room,
  Controller,
  Player,
  Me,
});
