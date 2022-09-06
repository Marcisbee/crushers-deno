import { Exome, saveState, registerLoadable } from 'exome';

// import { schema } from '../utils/schema.ts';

import { Controller, Controllers } from './controllers.ts';

export function buildPayload(type: 'sync' | 'join' | 'me' | 'actions' | 'position', data: any, path?: string | number) {
  if (data instanceof Exome) {
    return JSON.stringify({ type, path, data: saveState(data)});
  }

  return JSON.stringify({ type, path, data })
}

export type Action = 'up' | 'down' | 'left' | 'right';

export class Player extends Exome {
  public x = 0;
  public y = 0;
  public dy = 0;
  public dx = 0;
  public actions: Action[] = [];
  public isGrounded = false;
  public isDead = false;
  public score = 0;

  constructor(
    public startX = 60,
    public startY = 400,
  ) {
    super();
    this.x = this.startX;
    this.y = this.startY;
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

  public setX(x: number) {
    this.x = x;
  }

  public setY(y: number) {
    this.y = y;
  }

  public jump(dy: number) {
    this.y -= 1;
    this.dy = dy;
  }

  public setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public die() {
    this.isDead = true;
  }
}

export class Room extends Exome {
  public connections: WebSocket[] = [];
  public controllers: Controller[] = [];
  public max = 10;
  private startPositions = [
    '50,50',
    '100,50',
    '150,50',
    '200,50',
  ];

  public join(ws: WebSocket, controllers: Controllers) {
    if (!controllers.controllers) {
      return;
    }

    if (this.controllers.length > this.max) {
      console.log('MAX REACHED');
      return;
    }

    if (this.controllers.length + controllers.controllers.filter(Boolean).length > this.startPositions.length) {
      console.log('NO MORE FREE SPAWNS');
      return;
    }

    const all = this.controllers
      .filter((controller) => !!controller.player)
      .map((controller) => `${controller.player!.startX},${controller.player!.startY}`);
    const availablePositions = this.startPositions.filter((xy) => all.indexOf(xy) === -1);

    for (const controller of controllers.controllers) {
      if (!controller) {
        continue;
      }

      const [x, y] = availablePositions.shift()!.split(',');

      controller.setPlayer(new Player(parseInt(x, 10), parseInt(y, 10)));
      this.controllers.push(controller);
    }

    this.connections.push(ws);

    this.sync();
  }

  public leave(ws: WebSocket, controllers: Controllers) {
    for (const controller of controllers.controllers.slice(0)) {
      const index = this.controllers.indexOf(controller!);

      if (index === -1) {
        continue;
      }

      this.controllers.splice(index, 1);
    }

    const index = this.connections.indexOf(ws);
    this.connections.splice(index, 1);

    this.sync();
  }

  public broadcast = (exclude: Room['connections'][0], payload: string | ArrayBufferLike) => {
    this.connections.forEach((ws) => {
      if (ws === exclude) {
        return;
      }

      ws.send(payload);
    });
  }

  public sync = (exclude?: Room['connections'][0]) => {
    this.connections.forEach((ws) => {
      if (ws === exclude) {
        return;
      }

      ws.send(buildPayload('sync', this));
    });
  }
}

export const room = new Room();

registerLoadable({
  Room,
  Player,
});
