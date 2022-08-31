/** @jsx h */
import { h } from "preact";
import { useEffect, useLayoutEffect, useMemo } from "preact/hooks";
import { addMiddleware, getExomeId, loadState, onAction } from "exome";
// import { exomeDevtools } from "exome/devtools";

// addMiddleware(exomeDevtools({
//   name: 'game',
// }));
import levelGhostJson from '../levels/ghost.json' assert { type: "json" };

import { type Action, buildPayload, Controller, Me, room, Room } from "../store/game.ts";
import { useStore } from "../utils/use-store.ts";

const MAP = { tw: 64, th: 48 };
const TILE = 20;

let cells: number[] = [];

function t2p(t: number) { return t * TILE; }
function p2t(p: number) { return Math.floor(p / TILE); }
function cell(x: number, y: number) { return tcell(p2t(x), p2t(y)); }
function tcell(tx: number, ty: number) { return cells[tx + (ty * MAP.tw)]; }

function setup(map: any) {
  var data = map.layers[0].data,
    objects = map.layers[1].objects,
    n, obj, entity;

  for (n = 0; n < objects.length; n++) {
    obj = objects[n];
    // entity = setupEntity(obj);
    switch (obj.type) {
      case "player": console.log(obj); break;
      // case "monster": monsters.push(entity); break;
      // case "treasure": treasure.push(entity); break;
    }
  }

  cells = data;
}
setup(levelGhostJson);
// console.log(cells);

interface GameProps {}

const me = new Me();

const ACTIONS: Record<Action, (player: Controller, dt: number, force: number) => void> = {
  up(player, dt, force) {
    if (player.isDead) return;
    if (!player.isGrounded) return;

    player.isGrounded = false;

    player.jump(-0.25 * force * dt);
  },
  right(player, dt, force) {
    if (player.isDead) return;

    const change = 0.1 * force * dt;
    player.setX(Math.min(player.x + change, (MAP.tw - 1) * TILE));
  },
  left(player, dt, force) {
    if (player.isDead) return;

    const change = 0.1 * force * dt;
    player.setX(Math.max(player.x - change, 0));
  },
  down() {},
};

let dt = 0;

function handleActions(player: Controller) {
  for (const action of player.actions) {
    ACTIONS[action](player, dt, 1);
  }
}

const world = {
  gravity: 0.8, // strength per frame of gravity
  drag: 0.999, // play with this value to change drag
  groundDrag: 0.9, // play with this value to change ground movement
  ground: (MAP.th - 1) * TILE,
};

// function playersIntersect(player1: Controller, player2: Controller) {
//   return !(player1.x > (player2.x + playerDefaults.width) ||
//     (player1.x + playerDefaults.width) < player2.x ||
//     player1.y > (player2.y + playerDefaults.height) ||
//     (player1.y + playerDefaults.height) < player2.y);
// }

function recalculatePosition(player: Controller) {
  var tx = p2t(player.x),
    ty = p2t(player.y),
    nx = player.x % TILE,
    ny = player.y % TILE,
    cell = tcell(tx, ty),
    cellright = tcell(tx + 1, ty),
    celldown = tcell(tx, ty + 1),
    celldiag = tcell(tx + 1, ty + 1);

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

  if (!player.isGrounded) {
    player.dy += world.gravity;
    player.dy *= world.drag;
    player.dy = Math.min(TILE, player.dy);
    player.setY(player.y += player.dy);
  }

  // Don't fall below bottom
  if (player.y >= world.ground) {
    player.isGrounded = true;
    if (player.y !== world.ground) {
      player.setY(world.ground);
    }
  }

  if (player.isGrounded && !(celldown || (nx && celldiag))) {
    player.isGrounded = false;
  }
}

function PlayerControls({ controller, room }: { controller: Controller, room: Room }) {
  const { x, y, dx, dy, isGrounded, keys: [keyUp, keyDown, keyLeft, keyRight], actions, addAction, removeAction } = useStore(controller);

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === keyUp) {
        e.preventDefault();

        if (actions.indexOf('up') > -1) {
          return;
        }

        addAction('up');
        return;
      }

      if (e.key === keyDown) {
        e.preventDefault();

        if (actions.indexOf('down') > -1) {
          return;
        }

        addAction('down');
        return;
      }

      if (e.key === keyLeft) {
        e.preventDefault();

        if (actions.indexOf('left') > -1) {
          return;
        }

        addAction('left');
        return;
      }

      if (e.key === keyRight) {
        e.preventDefault();

        if (actions.indexOf('right') > -1) {
          return;
        }

        addAction('right');
        return;
      }

      console.log(e.key);
    }

    function handleKeyRelease(e: KeyboardEvent) {
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

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyRelease);

    const selfId = getExomeId(controller);

    let running = true;
    let secondsPassed;
    let oldTimeStamp: number;
    let fps;

    function gameLoop(timeStamp: number) {
      if (!running) {
        return;
      }

      // Calculate the number of seconds passed since the last frame
      secondsPassed = (timeStamp - oldTimeStamp) / 1000;
      oldTimeStamp = timeStamp;

      // Calculate fps
      fps = Math.round(1 / secondsPassed);
      dt = fps;

      if (room.connections.length) {
        handleActions(controller);
        recalculatePosition(controller);

        for (const connection of room.connections) {
          if (selfId === getExomeId(connection.controller)) {
            continue;
          }

          handleActions(connection.controller);
          recalculatePosition(connection.controller);
        }
      }

      // The loop function has reached it's end. Keep requesting new frames
      window.requestAnimationFrame(gameLoop);
    }

    gameLoop(0);

    return () => {
      running = false;
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyRelease);
    };
  }, []);

  return (
    <div>
      {/* <pre>{JSON.stringify({
        jump: keyUp,
        // keyDown,
        left: keyLeft,
        right: keyRight,
      })}</pre> */}

      <div
        style={{
          width: TILE,
          height: TILE,
          position: 'absolute',
          backgroundColor: 'orange',
          top: 0,
          left: 0,
          transform: `translate3d(${x}px, ${y}px, 0)`,
          zIndex: 1
        }}
      />

      <pre>
        {JSON.stringify({
          x,
          y,
          dx,
          dy,
          isGrounded,
          actions: actions.join(),
        }, null, 2)}
      </pre>
    </div>
  );
}

function PlayerComponent({ controller }: { controller: Controller }) {
  const { name, x, y, dx, dy, actions } = useStore(controller);

  return (
    <div>
      <div
        style={{
          width: TILE,
          height: TILE,
          position: 'absolute',
          backgroundColor: 'red',
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
    let x, y, cell;

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

export default function Game(props: GameProps) {
  // const [sync, setSync] = useState('null');
  const roomData = useStore(room);
  const meData = useStore(me);

  useLayoutEffect(() => {
    const ws = new WebSocket('ws://192.168.1.110:8000/api/ws');

    ws.onclose = () => {
      console.log('izmeta no spēles');
    }

    ws.onerror = () => {
      console.log('error');
    }

    ws.onmessage = (e) => {
      // console.log('message', e);
      const { type, data, path } = JSON.parse(e.data);

      if (type === 'sync') {
        // setSync(data);
        console.log(loadState(room, data));
      }

      if (type === 'position') {
        console.log(loadState(room.connections[path].controller, data));
      }

      if (type === 'me') {
        // setSync(data);
        console.log(loadState(me, data));

        onAction(Controller, 'addAction', (instance) => {
          if (instance !== meData.controller) {
            return;
          }

          ws.send(buildPayload('actions', instance));
          console.log('UPDATE ME addAction', instance.actions.toString());
        });

        onAction(Controller, 'removeAction', (instance) => {
          if (instance !== meData.controller) {
            return;
          }

          ws.send(buildPayload('actions', instance));
          console.log('UPDATE ME removeAction', instance.actions.toString());
        });
      }
    }

    ws.onopen = (e) => {
      console.log(e);
    }
  }, []);

  return (
    <div>
      <h2>Hello {meData.controller?.name}</h2>
      <h2>Room:</h2>
      <GameMap />
      {meData.controller && (
        <PlayerControls
          controller={meData.controller}
          room={roomData as any}
        />
      )}
      {roomData.connections.map((player) => {
        if (getExomeId(player.controller) === getExomeId(meData.controller!)) {
          return null;
        }

        return (
          <PlayerComponent
            key={getExomeId(player.controller)}
            controller={player.controller}
          />
        );
      })}
      {/* <pre>{JSON.stringify(roomData, null, 2)}</pre> */}
    </div>
  );
}
