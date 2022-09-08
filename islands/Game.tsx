// deno-lint-ignore-file no-window-prefix
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { Exome, getExomeId, loadState, onAction, addMiddleware } from 'exome';
import { subscribe } from 'exome/subscribe';
// import { exomeDevtools } from 'exome/devtools';

import levelFirst from '../levels/first.ts';

import { schema } from '../utils/schema.ts';
import { type Action, buildPayload, Player, room, Room } from '../store/game.ts';
import { useStore } from '../utils/use-store.ts';
import { Controller, Controllers, KeyboardArrowController, KeyboardWasdController } from '../store/controllers.ts';

const MAP = { tw: levelFirst.width, th: levelFirst.height };
const TILE = 20;

const cells: number[] = levelFirst.data;

function t2p(t: number) { return t * TILE; }
function p2t(p: number) { return Math.floor(p / TILE); }
function cell(x: number, y: number) { return tcell(p2t(x), p2t(y)); }
function tcell(tx: number, ty: number) { return cells[tx + (ty * MAP.tw)]; }

interface GameProps {}

const ACTIONS: Record<Action, (player: Player, dt: number, force: number) => void> = {
  up(player, dt, force) {
    if (player.isDead) return;
    if (!player.isGrounded) return;

    player.isGrounded = false;

    player.jump(-world.MAX_SPEED);
  },
  right(player, dt, force) {
    if (player.isDead) return;

    const change = 6.3 * force * dt;
    player.setX(Math.min(player.x + change, (MAP.tw - 1) * TILE));
  },
  left(player, dt, force) {
    if (player.isDead) return;

    const change = 6.3 * force * dt;
    player.setX(Math.max(player.x - change, 0));
  },
  down() {},
};

let dt = 1;

function handleActions(player: Player) {
  for (const action of player.actions) {
    ACTIONS[action](player, dt, 1);
  }
}

const world = {
  gravity: 0.9, // strength per frame of gravity
  drag: 0.999, // play with this value to change drag
  // groundDrag: 0.9, // play with this value to change ground movement
  ground: (MAP.th - 1) * TILE,
  MAX_SPEED: 15,
};

function playersIntersect(player1: Player, player2: Player) {
  return !(player1.x > (player2.x + TILE) ||
    (player1.x + TILE) < player2.x ||
    player1.y > (player2.y + TILE) ||
    (player1.y + TILE) < player2.y);
}

function bound(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function recalculatePosition(player: Player) {
  // Don't fall below bottom
  if (player.y >= world.ground) {
    player.isGrounded = true;
    if (player.y !== world.ground) {
      player.setY(world.ground);
    }
  }

  // Do the passive jumping/falling animation
  if (!player.isGrounded) {
    player.dy = bound(player.dy + world.gravity * (dt || 1), -world.MAX_SPEED, world.MAX_SPEED);
    player.setY(player.y + player.dy * (dt || 1));

    if (document.getElementById('debug')) {
      document.getElementById('debug')!.innerHTML = JSON.stringify({
        dt,
        isGrounded: player.isGrounded,
        y: player.y,
        dy: player.dy,
      }, null, 2);
    }
  }

  const tx = p2t(player.x);
  const ty = p2t(player.y);
  const nx = player.x % TILE;
  let ny = player.y % TILE;
  let cell = tcell(tx, ty);
  let cellright = tcell(tx + 1, ty);
  const celldown = tcell(tx, ty + 1);
  const celldiag = tcell(tx + 1, ty + 1);

  if (!player.isGrounded) {
    if (player.dy > 0) {
      if ((celldown && !cell) ||
        (celldiag && !cellright && nx)) {
        player.dy = 0;            // stop downward velocity
        player.isGrounded = true; // no longer falling
        player.setY(t2p(ty));     // clamp the y position to avoid falling into platform below
        ny = 0;                       // - no longer overlaps the cells below
      }
    }
    else if (player.dy < 0) {
      if ((cell && !celldown) ||
        (cellright && !celldiag && nx)) {
        player.dy = 0;            // stop upward velocity
        player.setY(t2p(ty + 1)); // clamp the y position to avoid jumping into platform above
        cell = celldown;              // player is no longer really in that cell, we clamped them to the cell below 
        cellright = celldiag;         // (ditto)
        ny = 0;                       // player no longer overlaps the cells below
      }
    }
  }

  // @TODO: Add dx functionality
  if (player.actions.indexOf('right') > -1) {
    if ((cellright && !cell) ||
      (celldiag && !celldown && ny)) {
      // player.dx = 0;              // stop horizontal velocity
      player.setX(t2p(tx));       // clamp the x position to avoid moving into the platform we just hit
    }
  }
  else if (player.actions.indexOf('left') > -1) {
    if ((cell && !cellright) ||
      (celldown && !celldiag && ny)) {
      // player.dx = 0;              // stop horizontal velocity
      player.setX(t2p(tx + 1));   // clamp the x position to avoid moving into the platform we just hit
    }
  }

  if (player.isGrounded && !(celldown || (nx && celldiag))) {
    player.isGrounded = false;
  }
}

const localControllers = new Controllers();

class Scene extends Exome {}
class WelcomeScene extends Scene { public controllers = localControllers; }
class JoiningRoomScene extends Scene { public controllers = localControllers; }
class RoomScene extends Scene {
  public controllers = localControllers;

  constructor() {
    super();

    function handleKeyPress(e: KeyboardEvent) {

      for (const controller of localControllers.controllers) {
        if (!(controller && controller.player)) {
          continue;
        }

        if (controller instanceof KeyboardArrowController
          || controller instanceof KeyboardWasdController) {
          const {
            keybinding: [keyUp, keyDown, keyLeft, keyRight],
            player: {
              actions,
              addAction,
            },
          } = controller;

          if (e.key === keyUp) {
            e.preventDefault();

            if (actions.indexOf('up') > -1) {
              continue;
            }

            addAction('up');
            continue;
          }

          if (e.key === keyDown) {
            e.preventDefault();

            if (actions.indexOf('down') > -1) {
              continue;
            }

            addAction('down');
            continue;
          }

          if (e.key === keyLeft) {
            e.preventDefault();

            if (actions.indexOf('left') > -1) {
              continue;
            }

            addAction('left');
            continue;
          }

          if (e.key === keyRight) {
            e.preventDefault();

            if (actions.indexOf('right') > -1) {
              continue;
            }

            addAction('right');
            continue;
          }

          console.log(e.key);
        }
      }
    }

    function handleKeyRelease(e: KeyboardEvent) {
      for (const controller of localControllers.controllers) {
        if (!(controller && controller.player)) {
          continue;
        }

        if (controller instanceof KeyboardArrowController
          || controller instanceof KeyboardWasdController) {
          const {
            keybinding: [keyUp, keyDown, keyLeft, keyRight],
            player: {
              removeAction,
            },
          } = controller;

          if (e.key === keyUp) {
            removeAction('up');
            return;
          }

          if (e.key === keyDown) {
            removeAction('down');
            return;
          }

          if (e.key === keyLeft) {
            removeAction('left');
            return;
          }

          if (e.key === keyRight) {
            removeAction('right');
            return;
          }

          console.log(e.key);
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyRelease);

    let running = true;
    // let secondsPassed;
    let oldTimeStamp: number;
    // let fps;

    function gameLoop(timeStamp: number) {
      if (!running) {
        return;
      }

      // Calculate the number of seconds passed since the last frame
      // secondsPassed = (timeStamp - oldTimeStamp) / 1000;

      // Calculate fps
      // fps = Math.round(1 / secondsPassed);
      dt = Math.min((timeStamp - oldTimeStamp) / 20, 5);
      oldTimeStamp = timeStamp;

      if (room.controllers.length) {
        for (const controller of room.controllers) {
          if (!controller.player) {
            continue;
          }

          if (!controller.player.isDead) {
            handleActions(controller.player);
          }

          recalculatePosition(controller.player);
          
          for (const localController of localControllers.controllers) {
            if (!localController) {
              continue;
            }

            if (localController === controller) {
              continue;
            }

            if (playersIntersect(localController.player!, controller.player) && controller.player!.y > localController.player!.y) {
              controller.player.die();
            }
          }

          // if (playersIntersect(localController.player!, controller!.player) && controller.y > connection.controller!.y) {
          //   // controller.die();
          // }
        }
      }

      // The loop function has reached it's end. Keep requesting new frames
      window.requestAnimationFrame(gameLoop);
      // window.setTimeout(gameLoop, 100, 1);
    }

    gameLoop(0);

    // return () => {
    //   running = false;
    //   window.removeEventListener('keydown', handleKeyPress);
    //   window.removeEventListener('keyup', handleKeyRelease);
    // };
  // }, []);
  }
}

class Screen extends Exome {
  public scene: Scene = new WelcomeScene();

  public joinGame() {
    this.scene = new JoiningRoomScene();
    connection.joinGame();
  }

  public startGame() {
    this.scene = new RoomScene();
  }
}
const screen = new Screen();

function PlayerComponent({ controller }: { controller: Controller }) {
  const { name, color } = controller;
  const { x, y } = controller.player!;

  const player = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!player.current) {
      return;
    }

    return subscribe(controller.player!, ({ x, y, isDead }) => {
      player.current!.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      if (isDead) {
        player.current!.style.backgroundColor = 'rgba(0,0,0,0.2)';
      }
    });
  }, [controller.player!]);

  return (
    <div>
      <div
        ref={player}
        style={{
          width: TILE,
          height: TILE,
          position: 'absolute',
          backgroundColor: color,
          top: 0,
          left: 0,
          transform: `translate3d(${x}px, ${y}px, 0)`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: -20,
            transform: 'translate3d(-50%, -50%, 0)',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 6,
            color: '#fff',
            padding: '4px 8px',
            fontFamily: 'Arial',
          }}
        >
          {name}
        </span>
      </div>
      {/* <pre>
        {JSON.stringify({
          x,
          y,
          dx,
          dy,
          actions: actions.join(),
        }, null, 2)}
      </pre> */}
    </div>
  );
}

const MAP_COLORS: Record<number, string> = {
  2: 'silver',
  3: 'silver',
  4: '#603121',
  5: '#603121',
}

function GameMap() {
  const mapData = useMemo(() => {
    const output: [number, number, number][] = [];
    let x;
    let y;
    let cell;

    for (y = 0; y < MAP.th; y++) {
      for (x = 0; x < MAP.tw; x++) {
        cell = tcell(x, y);
        if (cell) {
          output.push([cell, x * TILE, y * TILE]);
          // ctx.fillStyle = COLORS[cell - 1];
          // ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }

    return output;
  }, []);

  return (
    <div>
      {mapData.map(([type, x, y]) => {
        return (
          <div
            key={`${x}:${y}`}
            style={{
              width: TILE,
              height: TILE,
              position: 'absolute',
              backgroundColor: MAP_COLORS[type] || 'silver',
              zIndex: -1,
              left: x,
              top: y,
              fontFamily: 'Arial',
              fontSize: 10,
              textAlign: 'center',
              color: '#555',
            }}
          >{type}</div>
        );
      })}
    </div>
  );
}

function RoomSceneComponent({ scene }: { scene: RoomScene }) {
  const roomData = useStore(room);

  return (
    <div>
      <h2>Room:</h2>
      <pre
        id="debug"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 100,
          width: '100%',
          fontSize: 12,
          backgroundColor: 'silver',
          margin: 0,
        }}
      />
      <GameMap />
      {roomData.controllers.map((controller) => {
        if (!(controller && controller.player)) {
          return null;
        }

        return (
          <PlayerComponent
            key={getExomeId(controller)}
            controller={controller}
          />
        );
      })}
      {/* <pre>{JSON.stringify(roomData, null, 2)}</pre> */}
    </div>
  );
}

class Connection extends Exome {
  public ws?: WebSocket;

  constructor() {
    super();

    const ws = new WebSocket('ws://192.168.1.100:8000/api/ws');

    ws.onclose = () => {
      this.disconnect();
    }

    ws.onerror = () => {
      this.disconnect();
      console.log('error');
    }

    let subA = () => {};
    let subB = () => {};

    ws.onmessage = async (e) => {
      if (e.data instanceof Blob) {
        const arrayBuffer = new Uint8Array(await e.data.arrayBuffer());
        const payload = schema.decodeExample(arrayBuffer);

        if (payload.actions) {
          Object.assign(
            room.controllers[payload.index].player!,
            payload.actions,
          );
          // loadState(room.controllers[payload.index].player!, payload.actions);
          return;
        }

        // if (payload.sync) {
        //   // Object.assign(
        //   //   room.controllers[payload.index].player!,
        //   //   payload.actions,
        //   // );
        //   // loadState(room.controllers[payload.index].player!, payload.actions);
        //   return;
        // }

        return;
      }

      const { type, data, path } = JSON.parse(e.data);

      // if (type === 'position') {
      //   loadState(room.controllers[path].player!, data);
      //   return;
      // }

      if (type === 'sync') {
        const expandedData = JSON.parse(data);

        room.controllers = expandedData.controllers.map((c1: Record<string, any>) => {
          const existing = room.controllers.find((c2) => getExomeId(c2) === c1.$$exome_id);

          if (existing) {
            return existing;
          }

          const local = localControllers.controllers.find((c2) => c2 && getExomeId(c2) === c1.$$exome_id);

          if (local) {
            return loadState(local, JSON.stringify(c1));
          }

          return loadState(new Controller(), JSON.stringify(c1))
        });

        // @TODO: Unsubscribe from actions and game loop when screen ends
        if (screen.scene instanceof RoomScene) {
          return;
        }

        // loadState(room, data);
        screen.startGame();

        subA = onAction(Player, 'addAction', (instance) => {
          // if (!localControllers.controllers.find((controller) => controller?.player === instance)) {
          //   return;
          // }

          const exomeId = getExomeId(instance);
          const index = room.controllers.findIndex((c) => c.player && getExomeId(c.player) === exomeId);
          // ws.send(buildPayload('actions', instance));
          const payload = schema.encodeExample({
            actions: instance,
            index,
          });
          ws.send(payload);
          // console.log('UPDATE ME addAction', instance.actions.toString());
        });

        subB = onAction(Player, 'removeAction', (instance) => {
          // if (!localControllers.controllers.find((controller) => controller?.player === instance)) {
          //   return;
          // }

          const exomeId = getExomeId(instance);
          const index = room.controllers.findIndex((c) => c.player && getExomeId(c.player) === exomeId);
          // ws.send(buildPayload('actions', instance));
          const payload = schema.encodeExample({
            actions: instance,
            index,
          });
          ws.send(payload);
          // console.log('UPDATE ME removeAction', instance.actions.toString());
        });

        // @TODO: implement kill conflict
        // @TODO: Figure out why death only appears after moving
        onAction(Player, 'die', (instance) => {
          // if (instance !== meData.controller) {
          //   return;
          // }

          const exomeId = getExomeId(instance);
          const index = room.controllers.findIndex((c) => c.player && getExomeId(c.player) === exomeId);
          const payload = schema.encodeExample({
            actions: instance,
            index,
          });
          ws.send(payload);
        });
        return;
      }
    }

    ws.onopen = (e) => {
      this.connect(ws);
    }
  }

  public joinGame() {
    this.ws?.send(buildPayload('join', localControllers));
  }

  public connect(ws: WebSocket) {
    this.ws = ws;
  }

  public disconnect() {
    this.ws = undefined;
  }
}
const connection = new Connection();

function WelcomeSceneComponent({ scene }: { scene: WelcomeScene }) {
  const {  } = useStore(scene);
  const { controllers, addController, removeController } = useStore(scene.controllers);

  useLayoutEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault();

        // Don't allow to join party with the same controller
        if (controllers.find((c) => c instanceof KeyboardArrowController)) {
          return;
        }

        addController(new KeyboardArrowController());
        return;
      }

      if (e.key === 'w') {
        e.preventDefault();

        // Don't allow to join party with the same controller
        if (controllers.find((c) => c instanceof KeyboardWasdController)) {
          return;
        }

        addController(new KeyboardWasdController());
        return;
      }
    }

    window.addEventListener('keyup', handleKeyPress);

    return () => {
      window.removeEventListener('keyup', handleKeyPress);
    }
  }, []);

  return (
    <div>
      <h1>Welcome to Crushers</h1>
      <h3>Assemble your party!</h3>
      <ul>
        {controllers.map((controller, index) => {
          if (!controller) {
            return (
              <li style={{ opacity: 0.2 }}>
                Player {index + 1} = ???
              </li>
            );
          }

          if (controller instanceof KeyboardArrowController) {
            return (
              <li>
                <span style={{ backgroundColor: controller.color }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> "{controller.name}" (Space, Left, Right) <button onClick={() => removeController(controller)}>kick</button>
              </li>
            );
          }

          if (controller instanceof KeyboardWasdController) {
            return (
              <li>
                <span style={{ backgroundColor: controller.color }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> "{controller.name}" (WAS) <button onClick={() => removeController(controller)}>kick</button>
              </li>
            );
          }

          return (
            <li>
              Player {index + 1} = ??? <button onClick={() => removeController(controller) }>kick</button>
            </li>
          );
        })}
      </ul>

      <p>Press <kbd>Space</kbd> or <kbd>W</kbd> or <kbd>X</kbd> to join</p>

      <button
        disabled={controllers.filter(Boolean).length === 0}
        onClick={() => {
          screen.joinGame();
        }}
      >
        Join server
      </button>
    </div>
  );
}

function JoiningRoomSceneComponent({ scene }: { scene: JoiningRoomScene }) {
  const {  } = useStore(scene);
  const { controllers, addController, removeController } = useStore(scene.controllers);

  return (
    <div>
      <h1>Welcome to Crushers</h1>
      <h3>Joining server...</h3>
      <ul>
        {controllers.map((controller, index) => {
          if (!controller) {
            return null;
          }

          if (controller instanceof KeyboardArrowController) {
            return (
              <li>
                <span style={{ backgroundColor: controller.color }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> "{controller.name}" (Space, Left, Right)
              </li>
            );
          }

          if (controller instanceof KeyboardWasdController) {
            return (
              <li>
                <span style={{ backgroundColor: controller.color }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> "{controller.name}" (WAS)
              </li>
            );
          }

          return (
            <li>
              Player {index + 1} = ???
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Main(props: GameProps) {
  const { scene } = useStore(screen);
  const { ws } = useStore(connection);

  if (!ws) {
    return (
      <div>
        Loading..
      </div>
    );
  }

  if (scene instanceof WelcomeScene) {
    return (
      <div>
        <WelcomeSceneComponent scene={scene} />
      </div>
    );
  }

  if (scene instanceof JoiningRoomScene) {
    return (
      <div>
        <JoiningRoomSceneComponent scene={scene} />
      </div>
    );
  }

  if (scene instanceof RoomScene) {
    return (
      <div>
        <RoomSceneComponent scene={scene} />
      </div>
    );
  }

  return (
    <div>
      Something went wrong, no scene found.
    </div>
  );
}
