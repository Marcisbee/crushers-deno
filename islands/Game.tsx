/** @jsx h */
import { h } from "preact";
import { useEffect, useLayoutEffect } from "preact/hooks";
import { addMiddleware, getExomeId, loadState, onAction } from "exome";
// import { exomeDevtools } from "exome/devtools";

// addMiddleware(exomeDevtools({
//   name: 'game',
// }));

import { type Action, buildPayload, Controller, Me, room, Room } from "../store/game.ts";
import { useStore } from "../utils/use-store.ts";

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
    player.setX(Math.min(player.x + change, 200));
  },
  left(player, dt, force) {
    if (player.isDead) return;

    const change = 0.1 * force * dt;
    player.setX(Math.max(player.x - change, 0));
  },
  down() {},
};

// const perfectFrameTime = 1000 / 60;
let dt = 0;
// let lastUpdate: number | null = null;

function handleActions(player: Controller) {
  for (const action of player.actions) {
    ACTIONS[action](player, dt, 1);
  }
}

const world = {
  gravity: 0.8, // strength per frame of gravity
  drag: 0.999, // play with this value to change drag
  groundDrag: 0.9, // play with this value to change ground movement
  ground: 200,
};

// const playerDefaults = {
//   width: 20,
//   height: 20,
// };

// function playersIntersect(player1: Controller, player2: Controller) {
//   return !(player1.x > (player2.x + playerDefaults.width) ||
//     (player1.x + playerDefaults.width) < player2.x ||
//     player1.y > (player2.y + playerDefaults.height) ||
//     (player1.y + playerDefaults.height) < player2.y);
// }

function PlayerControls({ controller, room }: { controller: Controller, room: Room }) {
  const { name, x, y, dx, dy, keys: [keyUp, keyDown, keyLeft, keyRight], actions, addAction, removeAction } = useStore(controller);

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

        if (!controller.isGrounded) {
          controller.dy += world.gravity;
          controller.dy *= world.drag;
          controller.setY(controller.y += controller.dy);
        }

        if (controller.y >= world.ground) {
          controller.isGrounded = true;
          // controller.y = world.ground;
          if (controller.y !== world.ground) {
            controller.setY(world.ground);
          }
        }

        for (const connection of room.connections) {
          if (selfId === getExomeId(connection.controller)) {
            continue;
          }

          handleActions(connection.controller);

          if (!connection.controller.isGrounded) {
            connection.controller.dy += world.gravity;
            connection.controller.dy *= world.drag;
            connection.controller.setY(connection.controller.y += connection.controller.dy);
          }

          if (connection.controller.y >= world.ground) {
            connection.controller.isGrounded = true;

            if (connection.controller.y !== world.ground) {
              connection.controller.setY(world.ground);
            }
          }
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
          width: 20,
          height: 20,
          position: 'absolute',
          backgroundColor: 'orange',
          top: 20,
          left: 20,
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
          width: 20,
          height: 20,
          position: 'absolute',
          backgroundColor: 'red',
          top: 20,
          left: 20,
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

    // console.log(ws);
  }, []);

  // useEffect(() => {
  //   if (!meData.controller) {
  //     return;
  //   }

  //   const selfId = getExomeId(meData.controller);

  //   let running = true;
  //   function tick() {
  //     if (!running) {
  //       return;
  //     }

  //     requestAnimationFrame(() => {
  //       // handleActions(Object.keys(keysPressedMap));
  //       // const currentState = JSON.stringify(state);
  //       // const tempState = lastState;
  //       // lastState = currentState;

  //       const now = new Date().getTime();

  //       if (lastUpdate === null) {
  //         lastUpdate = now;
  //       }

  //       dt = (now - lastUpdate) / perfectFrameTime;
  //       lastUpdate = now;

  //       if (!roomData.connections.length) {
  //         tick();
  //         return;
  //       }

  //       // console.log(roomData.connections.map((c) => c.controller.name));
  //       for (const connection of roomData.connections) {
  //         // if (selfId !== getExomeId(connection.controller)) {
  //         //   continue;
  //         // }
  //         handleActions(connection.controller, selfId === getExomeId(connection.controller));
  //       }

  //       // ctx.clearRect(0, 0, canvas.width, canvas.height);
  //       // render(ctx, keysPressedMap);

  //       tick();
  //     });
  //   }

  //   tick();

  //   return () => {
  //     running = false;
  //   };
  // }, [meData.controller && getExomeId(meData.controller)]);

  return (
    <div>
      <h2>Hello {meData.controller?.name}</h2>
      <h2>Room:</h2>
      {meData.controller && (
        <PlayerControls
          controller={meData.controller}
          room={roomData}
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
